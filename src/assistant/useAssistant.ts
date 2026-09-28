/**
 * Conversation state and the tool loop.
 *
 * The loop is: send the conversation, let the model call tools, run them, feed the results back,
 * repeat until it answers in prose. Capped at a few rounds so a confused model cannot spin.
 */

import { useCallback, useRef, useState } from 'react'

import { OllamaClient, type HealthResult } from '../lib/llm/client'
import { buildSystemPrompt, type PromptContext } from '../lib/llm/systemPrompt'
import { TOOL_DEFINITIONS, dispatchTool, newTurn, pagePath, type PageRef } from '../lib/llm/tools'
import type { ValidationResult } from '../lib/llm/validate'
import type { ChatMessage, ToolCall } from '../lib/llm/types'
import { getCurrentCircuit } from '../circuit/circuitBridge'

const MAX_TOOL_ROUNDS = 4
/** Conversation turns kept in context. Retrieved content is re-fetched each turn anyway. */
const HISTORY_TURNS = 6

export interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  thinking?: string
  /** Circuits this turn's answer shows — final versions only; see keepCircuit. */
  circuits: ValidationResult[]
  /** Site pages the answer drew on, offered at its end so the reader can go and read more. */
  sources?: PageRef[]
  /** Python the tutor offered this turn, for the user to accept into their editor. */
  snippets: PythonSnippet[]
  toolsUsed: string[]
  error?: string
  streaming?: boolean
}

export interface PythonSnippet {
  code: string
  explanation?: string
}

export type AssistantStatus = 'idle' | 'thinking' | 'working' | 'streaming'

/**
 * Whether to let the model reason before answering.
 *
 * Measured, not assumed — and the measurement contradicted the assumption. Running the eval set
 * both ways with Qwen3-14B:
 *
 *   reasoning on   10/12 passed in 936s
 *   reasoning off  11/12 passed in 102s
 *
 * Nine times faster and a better score. Grover in particular never finished with reasoning on: the
 * model spent over three minutes in a single reasoning pass without ever emitting a tool call,
 * where with it off it produced a correct circuit in 24 seconds.
 *
 * So this returns false. The plumbing stays because the finding is model-specific — a different
 * model may well benefit, and `EVAL_THINK=1` plus the eval set is how you would find out.
 */
export function wantsDeepThinking(_text: string): boolean {
  return false
}

let nextId = 0
const newId = () => `m${nextId++}`

/** A circuit the answer will show, and the tool round it arrived in. */
export interface KeptCircuit {
  result: ValidationResult
  round: number
}

/**
 * Fold one more accepted circuit into what the answer shows.
 *
 * The reader sees final versions only. A tutor that corrects itself mid-turn is doing its job, but
 * its discarded attempts are working, not answer — shown to a learner, even folded away, they raise
 * "which one is right?" and "what went wrong?", neither of which is the question they asked.
 *
 * What counts as a correction has to be decided from the outside, so the rule leans on the one thing
 * that is certain: a circuit can only be a correction of one the model has already SEEN the result
 * of, which means one from an earlier round. So, for a new circuit:
 *
 *   1. same size and same state as one already kept   → a repeat; ignore it
 *   2. same size as one from an earlier round           → a correction; it replaces that one
 *   3. otherwise                                        → a separate circuit; add it
 *
 * Rule 1 also means that if the model shows the site's circuit and then rebuilds it anyway, the
 * site's own layout is what stays. Two circuits proposed in the same round are never corrections of
 * each other, so "show me a Bell state and a GHZ state" keeps both. The cost: a deliberate "show X,
 * then change it to Y" done over two rounds shows only Y.
 */
export function keepCircuit(
  kept: KeptCircuit[],
  result: ValidationResult,
  round: number,
): KeptCircuit[] {
  const size = result.circuit?.numQubits
  const state = result.outcome?.dirac
  const sameSize = (k: KeptCircuit) => k.result.circuit?.numQubits === size

  if (kept.some((k) => sameSize(k) && k.result.outcome?.dirac === state)) return kept

  let superseded = -1
  kept.forEach((k, i) => {
    if (sameSize(k) && k.round < round) superseded = i
  })
  if (superseded !== -1) {
    return kept.map((k, i) => (i === superseded ? { result, round } : k))
  }
  return [...kept, { result, round }]
}

/** How many pages an answer points to. Beyond this it stops being a pointer and becomes a list. */
export const MAX_SOURCES = 3

/**
 * The pages to offer at the end of an answer: those its tools read, in the order they were read,
 * without repeats, and without the page the reader is already on — a link back to where you are is
 * no help.
 */
export function answerSources(read: PageRef[], currentSlug?: string): PageRef[] {
  const seen = new Set<string>()
  const out: PageRef[] = []
  for (const page of read) {
    const path = pagePath(page)
    if (page.slug === currentSlug || seen.has(path)) continue
    seen.add(path)
    out.push(page)
  }
  return out.slice(0, MAX_SOURCES)
}

export function useAssistant(
  context: PromptContext & { currentSlug?: string },
  /** Model to talk to. Omitted in tests and by callers happy with the configured default. */
  model?: string,
) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [status, setStatus] = useState<AssistantStatus>('idle')
  const [health, setHealth] = useState<HealthResult | undefined>()

  /*
   * Rebuilt whenever the reader picks a different model. The client holds its model for the life of
   * the instance, so reusing one across a switch would keep talking to the old one.
   */
  const clientRef = useRef<OllamaClient>()
  const modelRef = useRef<string>()
  if (!clientRef.current || modelRef.current !== model) {
    clientRef.current = new OllamaClient(model ? { model } : {})
    modelRef.current = model
  }
  const abortRef = useRef<AbortController>()

  const checkHealth = useCallback(async () => {
    const result = await clientRef.current!.health()
    setHealth(result)
    return result
  }, [])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = undefined
    setStatus('idle')
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    )
  }, [])

  const clear = useCallback(() => {
    stop()
    setMessages([])
  }, [stop])

  const send = useCallback(
    async (text: string) => {
      const question = text.trim()
      if (!question || status !== 'idle') return

      const health = await checkHealth()
      if (!health.ok) {
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: 'user', content: question, circuits: [], snippets: [], toolsUsed: [] },
          {
            id: newId(),
            role: 'assistant',
            content: '',
            circuits: [],
            snippets: [],
            toolsUsed: [],
            error: health.error ?? 'The local model is unavailable.',
          },
        ])
        return
      }

      const replyId = newId()
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'user', content: question, circuits: [], snippets: [], toolsUsed: [] },
        { id: replyId, role: 'assistant', content: '', circuits: [], snippets: [], toolsUsed: [], streaming: true },
      ])

      const abort = new AbortController()
      abortRef.current = abort

      // Scoped to this question: what the model looks up now must not be compared against a
      // circuit it asked for two questions ago.
      const turn = newTurn()

      const think = wantsDeepThinking(question)
      setStatus(think ? 'thinking' : 'streaming')

      // Rebuild the wire conversation from what is on screen, trimmed to recent turns.
      const history: ChatMessage[] = messages
        .slice(-HISTORY_TURNS * 2)
        .filter((m) => !m.error)
        .map((m) => ({ role: m.role, content: m.content }))

      const circuit = getCurrentCircuit()
      const wire: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt({ ...context, hasCircuit: Boolean(circuit?.placements.length) }) },
        ...history,
        { role: 'user', content: question },
      ]

      const update = (patch: Partial<DisplayMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, ...patch } : m)))

      try {
        let content = ''
        let thinking = ''
        let kept: KeptCircuit[] = []
        const read: PageRef[] = []
        const snippets: PythonSnippet[] = []
        const toolsUsed: string[] = []
        let lastRoundCalledTools = false

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const calls: ToolCall[] = []
          content = ''

          for await (const chunk of clientRef.current!.chat({
            messages: wire,
            tools: TOOL_DEFINITIONS,
            think,
            options: { temperature: 0.3 },
            signal: abort.signal,
          })) {
            if (chunk.thinking) {
              thinking += chunk.thinking
              update({ thinking })
            }
            if (chunk.content) {
              content += chunk.content
              setStatus('streaming')
              update({ content })
            }
            if (chunk.toolCalls) calls.push(...chunk.toolCalls)
          }

          lastRoundCalledTools = calls.length > 0
          if (!lastRoundCalledTools) break

          // Record the model's tool calls, then answer each one.
          wire.push({ role: 'assistant', content, tool_calls: calls })
          setStatus('working')

          for (const call of calls) {
            const name = call.function?.name ?? 'unknown'
            toolsUsed.push(name)
            const result = await dispatchTool(name, call.function?.arguments ?? {}, {
              currentCircuit: getCurrentCircuit(),
              currentSlug: context.currentSlug,
              turn,
            })
            if (result.circuit?.ok) kept = keepCircuit(kept, result.circuit, round)
            if (result.sources) read.push(...result.sources)
            if (result.python) snippets.push(result.python)
            wire.push({ role: 'tool', content: result.content, tool_name: name })
          }
          /*
           * Circuits are NOT published here. Shown as they arrive, a first attempt would sit on
           * screen until the correction replaced it — which is exactly the "wrong diagram first"
           * a learner should not see. They appear with the finished answer instead.
           */
          update({ toolsUsed: [...toolsUsed], snippets: [...snippets] })
        }

        /*
         * Always end on an answer. If the rounds ran out while the model was still calling tools,
         * the text on screen is whatever it said on the way — often it talking itself through a
         * fix ("that gives the wrong state, let me try…") about an attempt the reader never sees.
         * And sometimes the last round is simply empty. Either way, one more call with the tools
         * taken away makes it answer from everything it has now learned.
         */
        if (lastRoundCalledTools || !content.trim()) {
          content = ''
          setStatus('streaming')
          update({ content })
          for await (const chunk of clientRef.current!.chat({
            messages: wire,
            think,
            options: { temperature: 0.3 },
            signal: abort.signal,
          })) {
            if (chunk.thinking) thinking += chunk.thinking
            if (chunk.content) {
              content += chunk.content
              update({ content })
            }
          }
        }

        const circuits = kept.map((k) => k.result)
        const sources = answerSources(read, context.currentSlug)
        update({ content, thinking, circuits, sources, snippets, toolsUsed, streaming: false })
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          update({
            streaming: false,
            error: err instanceof Error ? err.message : 'Something went wrong talking to the model.',
          })
        }
      } finally {
        abortRef.current = undefined
        setStatus('idle')
      }
    },
    [checkHealth, context, messages, status],
  )

  return { messages, status, health, send, stop, clear, checkHealth }
}
