/**
 * Eval harness. Run with: npm run eval
 *
 * Needs a live Ollama, which is why it is deliberately NOT part of `npm test`.
 *
 * Temperature and seed are pinned so two runs are comparable — without that you cannot tell whether
 * a prompt change helped or the model simply rolled differently.
 */

import { OllamaClient, DEFAULT_MODEL } from '../src/lib/llm/client'
import { buildSystemPrompt } from '../src/lib/llm/systemPrompt'
import { TOOL_DEFINITIONS, dispatchTool } from '../src/lib/llm/tools'
import type { ChatMessage, ToolCall } from '../src/lib/llm/types'
import type { ValidationResult } from '../src/lib/llm/validate'
import { EVAL_CASES, type EvalCase } from './cases'

const MAX_TOOL_ROUNDS = 4
const SEED = 20260924
/**
 * Give up on a case after this long.
 *
 * Passing cases land in 30-60s; a case that runs for ten minutes is cycling through failed retries
 * and tells you nothing more at minute nine than it did at minute two. Without this the suite is
 * too slow to use as a feedback loop, which is the whole point of having it.
 */
const CASE_TIMEOUT_MS = 180_000

interface CaseOutcome {
  id: string
  kind: 'circuit' | 'text'
  intent: string
  pass: boolean
  detail: string
  text: string
  ms: number
  evalTokens: number
  /** Which tools it reached for — absence of search_content usually explains a weak answer. */
  tools: string[]
}

/** Colours, skipped when output is redirected. */
const useColour = process.stdout.isTTY
const green = (s: string) => (useColour ? `\u001b[32m${s}\u001b[0m` : s)
const red = (s: string) => (useColour ? `\u001b[31m${s}\u001b[0m` : s)
const dim = (s: string) => (useColour ? `\u001b[2m${s}\u001b[0m` : s)

async function runCase(client: OllamaClient, testCase: EvalCase): Promise<CaseOutcome> {
  const started = Date.now()
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: testCase.prompt },
  ]

  let answer = ''
  let circuit: ValidationResult | undefined
  /** The last circuit the validator refused, so a failure can say what was actually wrong. */
  let rejected: ValidationResult | undefined
  let evalTokens = 0
  const tools: string[] = []

  let timedOut = false

  /*
   * The deadline must abort generation already in flight, not merely be checked between rounds.
   * A reasoning pass can run for many minutes, so a between-rounds check sails straight past the
   * limit — one case ran for eighteen minutes under exactly that bug.
   */
  const abort = new AbortController()
  const timer = setTimeout(() => {
    timedOut = true
    abort.abort()
  }, CASE_TIMEOUT_MS)

  try {
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (timedOut) break
    const calls: ToolCall[] = []
    answer = ''

    for await (const chunk of client.chat({
      messages,
      tools: TOOL_DEFINITIONS,
      /*
       * Off by default, matching what the app ships (see wantsDeepThinking). An eval that runs a
       * different configuration from production measures something no user experiences.
       * EVAL_THINK=1 turns it back on to re-test the trade-off for another model.
       */
      think: readEnv('EVAL_THINK') === '1',
      options: { temperature: 0, seed: SEED },
      signal: abort.signal,
    })) {
      if (chunk.content) answer += chunk.content
      if (chunk.toolCalls) calls.push(...chunk.toolCalls)
      if (chunk.stats?.evalTokens) evalTokens += chunk.stats.evalTokens
    }

    if (calls.length === 0) break

    messages.push({ role: 'assistant', content: answer, tool_calls: calls })
    for (const call of calls) {
      tools.push(call.function.name)
      const result = await dispatchTool(call.function.name, call.function.arguments ?? {})
      // Keep the last circuit that validated, and the last that did not.
      if (result.circuit?.ok) circuit = result.circuit
      else if (result.circuit) rejected = result.circuit
      messages.push({ role: 'tool', content: result.content, tool_name: call.function.name })
    }
  }
  } catch (err) {
    // Our own abort is an expected outcome, not a failure; anything else propagates.
    if (!(err instanceof Error && err.name === 'AbortError')) throw err
    timedOut = true
  } finally {
    clearTimeout(timer)
  }

  const ms = Date.now() - started

  /**
   * Tools the case insisted on. Checked separately from the physics because a circuit can be right
   * by luck while the behaviour under test — looking the answer up rather than recalling it — did
   * not happen.
   */
  const missingTools = (testCase.requireTools ?? []).filter((t) => !tools.includes(t))

  if (testCase.kind === 'circuit') {
    if (!circuit) {
      const why = timedOut
        ? `gave up after ${CASE_TIMEOUT_MS / 1000}s of failed retries${rejected?.errors.length ? ` — last rejection: ${rejected.errors.join('; ')}` : ''}`
        : rejected?.errors.length
        ? `validator rejected every attempt — last: ${rejected.errors.join('; ')}`
        : 'never called propose_circuit at all'
      return {
        id: testCase.id,
        kind: 'circuit',
        intent: testCase.intent,
        pass: false,
        detail: why,
        text: answer,
        ms,
        evalTokens,
        tools,
      }
    }
    const { pass, detail } = testCase.check(circuit)
    return {
      id: testCase.id,
      kind: 'circuit',
      intent: testCase.intent,
      pass: pass && missingTools.length === 0,
      detail: missingTools.length ? `${detail}; never called ${missingTools.join(', ')}` : detail,
      text: answer,
      ms,
      evalTokens,
      tools,
    }
  }

  if (timedOut && !answer.trim()) {
    return {
      id: testCase.id,
      kind: 'text',
      intent: testCase.intent,
      pass: false,
      detail: `gave up after ${CASE_TIMEOUT_MS / 1000}s with no answer`,
      text: '',
      ms,
      evalTokens,
      tools,
    }
  }

  const missing = testCase.expect.filter((re) => !re.test(answer))
  const forbidden = (testCase.reject ?? []).filter((re) => re.test(answer))
  return {
    id: testCase.id,
    kind: 'text',
    intent: testCase.intent,
    pass: missing.length === 0 && forbidden.length === 0 && missingTools.length === 0,
    detail: [
      missing.length ? `missing ${missing.map(String).join(', ')}` : '',
      forbidden.length ? `said ${forbidden.map(String).join(', ')}` : '',
      missingTools.length ? `never called ${missingTools.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ') || 'all expected terms present',
    text: answer,
    ms,
    evalTokens,
    tools,
  }
}

async function main() {
  const client = new OllamaClient({ baseUrl: 'http://localhost:11434' })

  const health = await client.health(5000)
  if (!health.ok) {
    console.error(red(`\n  ${health.error}\n`))
    console.error(dim('  The eval harness needs a running Ollama. Start it with:'))
    console.error(dim('    sudo systemctl start ollama'))
    console.error(dim(`    ollama pull ${DEFAULT_MODEL}\n`))
    process.exit(1)
  }

  const only = process.argv[2]
  const cases = only ? EVAL_CASES.filter((c) => c.id.includes(only)) : EVAL_CASES
  console.log(
    `\n  ${client.model} · ${cases.length} cases · temperature 0 · seed ${SEED}` +
      `${readEnv('EVAL_THINK') === '1' ? ' · reasoning ON' : ''}\n`,
  )

  const results: CaseOutcome[] = []
  for (const testCase of cases) {
    process.stdout.write(dim(`  ${testCase.id.padEnd(20)} running…`))
    const outcome = await runCase(client, testCase).catch((err) => ({
      id: testCase.id,
      kind: testCase.kind,
      intent: testCase.intent,
      pass: false,
      detail: `threw: ${err instanceof Error ? err.message : String(err)}`,
      text: '',
      ms: 0,
      evalTokens: 0,
      tools: [],
    }))
    results.push(outcome)

    const mark = outcome.pass ? green('PASS') : red('FAIL')
    const rate = outcome.ms > 0 ? `${((outcome.evalTokens / outcome.ms) * 1000).toFixed(0)} tok/s` : ''
    process.stdout.write(
      `\r  ${outcome.id.padEnd(20)} ${mark}  ${dim(`${(outcome.ms / 1000).toFixed(1)}s ${rate}`)}\n`,
    )
    console.log(dim(`    ${outcome.intent}`))
    console.log(dim(`    ${outcome.detail}`))
    console.log(
      dim(`    tools: ${outcome.tools.length ? [...new Set(outcome.tools)].join(', ') : 'NONE — answered from memory'}`),
    )
    if (!outcome.pass && outcome.text) {
      // Full text, not a snippet: when a case fails the answer IS the diagnostic, and a 160-char
      // truncation reliably cuts off exactly the part you need to see.
      console.log(dim('    said:'))
      for (const line of outcome.text.trim().split('\n')) console.log(dim(`      ${line}`))
    }
    console.log()
  }

  const circuits = results.filter((r) => r.kind === 'circuit')
  const texts = results.filter((r) => r.kind === 'text')
  const passed = results.filter((r) => r.pass).length
  const totalMs = results.reduce((a, r) => a + r.ms, 0)

  console.log('  ' + '─'.repeat(56))
  console.log(`  ${passed}/${results.length} passed in ${(totalMs / 1000).toFixed(0)}s`)
  console.log(
    `    circuits ${circuits.filter((r) => r.pass).length}/${circuits.length}   ` +
      `text ${texts.filter((r) => r.pass).length}/${texts.length}`,
  )
  console.log()
  console.log(
    dim(
      '  Circuit cases are scored by running the generated circuit through the simulator, so a\n' +
        '  pass means the physics is right. Text cases only check that expected words appear —\n' +
        '  that is a smoke test for grounding, NOT a check that the explanation is correct.',
    ),
  )
  console.log()

  process.exit(passed === results.length ? 0 : 1)
}

const readEnv = (name: string): string | undefined => process.env?.[name]

declare const process: {
  env?: Record<string, string | undefined>
  argv: string[]
  stdout: { isTTY: boolean; write: (s: string) => void }
  exit: (code: number) => never
}

void main()
