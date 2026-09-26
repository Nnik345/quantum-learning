/**
 * Minimal Ollama client.
 *
 * Written against `fetch` rather than the `ollama` npm package: it is a small amount of code, it
 * works unchanged in the browser and in Node 26, and it keeps the project's dependency list where
 * it is.
 *
 * In the browser the base URL is `/ollama`, proxied by Vite to the daemon — same-origin, so there
 * is no CORS configuration to get wrong and it works identically over an SSH tunnel. In Node
 * (the eval harness) it talks to the daemon directly.
 */

import type { ChatChunk, ChatMessage, ChatRequest, ToolCall } from './types'

/**
 * Which model to talk to.
 *
 * Overridable so a candidate can be A/B'd against the eval set without editing code —
 * `OLLAMA_MODEL=qwen3.5:9b npm run eval` scores it, and reverting is just dropping the variable.
 */
export const DEFAULT_MODEL = readEnv('OLLAMA_MODEL') || 'qwen3.5:9b'

/**
 * Context window requested per call.
 *
 * 8k, and this one is counter-intuitive enough to be worth recording. Qwen3.5-9B has the VRAM for
 * 16k on a 12 GB card — 6.0 GB resident, still 100% GPU — so it was raised. The eval then dropped
 * from 12/12 to 11/12, reproducibly across three runs, with Grover collapsing from 100% to 25% on
 * the marked state. Putting it back to 8k restored 12/12.
 *
 * The likely mechanism is that a larger window lets retrieval stuff in more material than the
 * model attends to well; whatever the cause, it is measured, not theorised. Fitting was never a
 * reason to use it. Raise it with OLLAMA_NUM_CTX and re-run the eval if you want to retest.
 */
export const DEFAULT_NUM_CTX = Number(readEnv('OLLAMA_NUM_CTX')) || 8192

const inBrowser = typeof window !== 'undefined'

/** Read a setting from Vite's env in the browser, or the process env under Node. */
function readEnv(name: string): string | undefined {
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as { env?: Record<string, string | undefined> }).env
      : undefined
  const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env
  return viteEnv?.[`VITE_${name}`] ?? nodeEnv?.[name]
}

function defaultBaseUrl(): string {
  const fromEnv = readEnv('OLLAMA_URL')
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return inBrowser ? '/ollama' : 'http://localhost:11434'
}

export interface ClientOptions {
  baseUrl?: string
  model?: string
}

/** One model the daemon has pulled, as offered in the picker. */
export interface AvailableModel {
  name: string
  /** On-disk size in bytes. Shown because it is what decides whether a model fits the card. */
  sizeBytes: number
  /** e.g. "9.7B", when the daemon reports it. */
  parameters?: string
  /** e.g. "Q4_K_M". */
  quantisation?: string
}

export interface HealthResult {
  ok: boolean
  models?: string[]
  /** Present when unreachable, phrased for display to a user. */
  error?: string
  /** True when the daemon answered but the configured model is not pulled. */
  modelMissing?: boolean
}

export class OllamaClient {
  readonly baseUrl: string
  readonly model: string

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? defaultBaseUrl()).replace(/\/$/, '')
    this.model = options.model ?? DEFAULT_MODEL
  }

  /** Is the daemon up, and is our model pulled? Used to fail helpfully rather than hang. */
  /**
   * Every model this daemon has pulled.
   *
   * The picker is built from this rather than from a list in the source, so it can only ever offer
   * models that are actually present — no dead entries, and no "not pulled" error reachable by
   * choosing something. It also means the same build adapts to an 8 GB machine and a 24 GB one
   * without being told which it is on.
   */
  async listModels(timeoutMs = 3000): Promise<AvailableModel[]> {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: abort.signal })
      if (!res.ok) return []
      const body = (await res.json()) as {
        models?: { name?: string; size?: number; details?: Record<string, string> }[]
      }
      return (body.models ?? [])
        .filter((m) => m.name)
        .map((m) => ({
          name: m.name!,
          sizeBytes: m.size ?? 0,
          parameters: m.details?.parameter_size,
          quantisation: m.details?.quantization_level,
        }))
        .sort((a, b) => a.sizeBytes - b.sizeBytes)
    } catch {
      return []
    } finally {
      clearTimeout(timer)
    }
  }

  async health(timeoutMs = 3000): Promise<HealthResult> {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), timeoutMs)
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: abort.signal })
      if (!res.ok) return { ok: false, error: `Ollama responded ${res.status}` }
      const body = (await res.json()) as { models?: { name?: string }[] }
      const models = (body.models ?? []).map((m) => m.name ?? '').filter(Boolean)
      // Tags carry a ":latest" suffix that a configured name may omit.
      const base = (n: string) => n.replace(/:latest$/, '')
      const present = models.some((m) => base(m) === base(this.model))
      return present
        ? { ok: true, models }
        : {
            ok: false,
            models,
            modelMissing: true,
            error: `Ollama is running but "${this.model}" is not pulled. Run: ollama pull ${this.model}`,
          }
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error && err.name === 'AbortError'
            ? 'Ollama did not respond in time'
            : 'Could not reach Ollama. Is the service running?',
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Stream a chat completion. Yields deltas with `thinking` already separated from `content`,
   * so hiding reasoning needs no tag parsing and cannot be broken by a chunk boundary.
   */
  async *chat(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const body = {
      model: this.model,
      messages: request.messages,
      stream: true,
      ...(request.tools?.length ? { tools: request.tools } : {}),
      ...(request.think !== undefined ? { think: request.think } : {}),
      options: {
        temperature: request.options?.temperature ?? 0.3,
        num_ctx: request.options?.numCtx ?? DEFAULT_NUM_CTX,
        ...(request.options?.seed !== undefined ? { seed: request.options.seed } : {}),
      },
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!res.ok || !res.body) {
      const detail = res.body ? await res.text().catch(() => '') : ''
      throw new Error(`Ollama chat failed (${res.status}) ${detail}`.trim())
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Ollama streams newline-delimited JSON; a chunk can split a line in half.
        let newline: number
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline).trim()
          buffer = buffer.slice(newline + 1)
          if (!line) continue
          const chunk = parseLine(line)
          if (chunk) yield chunk
        }
      }
      const tail = buffer.trim()
      if (tail) {
        const chunk = parseLine(tail)
        if (chunk) yield chunk
      }
    } finally {
      reader.releaseLock()
    }
  }

  /** Run a chat to completion and return the assembled message. */
  async complete(request: ChatRequest): Promise<{
    message: ChatMessage
    stats?: ChatChunk['stats']
  }> {
    let content = ''
    let thinking = ''
    const toolCalls: ToolCall[] = []
    let stats: ChatChunk['stats']

    for await (const chunk of this.chat(request)) {
      if (chunk.content) content += chunk.content
      if (chunk.thinking) thinking += chunk.thinking
      if (chunk.toolCalls) toolCalls.push(...chunk.toolCalls)
      if (chunk.stats) stats = chunk.stats
    }

    return {
      message: {
        role: 'assistant',
        content,
        ...(thinking ? { thinking } : {}),
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      stats,
    }
  }
}

interface RawChunk {
  message?: { content?: string; thinking?: string; tool_calls?: ToolCall[] }
  done?: boolean
  error?: string
  prompt_eval_count?: number
  eval_count?: number
  total_duration?: number
}

/** Parse one NDJSON line, tolerating anything unexpected rather than killing the stream. */
export function parseLine(line: string): ChatChunk | undefined {
  let raw: RawChunk
  try {
    raw = JSON.parse(line) as RawChunk
  } catch {
    return undefined
  }
  if (raw.error) throw new Error(`Ollama error: ${raw.error}`)

  const chunk: ChatChunk = { done: Boolean(raw.done) }
  if (raw.message?.content) chunk.content = raw.message.content
  if (raw.message?.thinking) chunk.thinking = raw.message.thinking
  if (raw.message?.tool_calls?.length) chunk.toolCalls = raw.message.tool_calls
  if (raw.done) {
    chunk.stats = {
      promptTokens: raw.prompt_eval_count,
      evalTokens: raw.eval_count,
      totalMs: raw.total_duration ? Math.round(raw.total_duration / 1e6) : undefined,
    }
  }
  return chunk
}
