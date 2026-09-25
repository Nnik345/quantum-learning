/**
 * Conversation state and the tool loop.
 *
 * The loop is: send the conversation, let the model call tools, run them, feed the results back,
 * repeat until it answers in prose. Capped at a few rounds so a confused model cannot spin.
 */

import { useCallback, useRef, useState } from 'react'

import { OllamaClient, type HealthResult } from '../lib/llm/client'
import { buildSystemPrompt, type PromptContext } from '../lib/llm/systemPrompt'
import { TOOL_DEFINITIONS, dispatchTool } from '../lib/llm/tools'
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
  /** Circuits produced this turn, already validated and simulated. */
  circuits: ValidationResult[]
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

export function useAssistant(context: PromptContext & { currentSlug?: string }) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [status, setStatus] = useState<AssistantStatus>('idle')
  const [health, setHealth] = useState<HealthResult | undefined>()

  const clientRef = useRef<OllamaClient>()
  if (!clientRef.current) clientRef.current = new OllamaClient()
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
        const circuits: ValidationResult[] = []
        const snippets: PythonSnippet[] = []
        const toolsUsed: string[] = []

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

          if (calls.length === 0) break

          // Record the model's tool calls, then answer each one.
          wire.push({ role: 'assistant', content, tool_calls: calls })
          setStatus('working')

          for (const call of calls) {
            const name = call.function?.name ?? 'unknown'
            toolsUsed.push(name)
            const result = await dispatchTool(name, call.function?.arguments ?? {}, {
              currentCircuit: getCurrentCircuit(),
              currentSlug: context.currentSlug,
            })
            if (result.circuit?.ok) circuits.push(result.circuit)
            if (result.python) snippets.push(result.python)
            wire.push({ role: 'tool', content: result.content, tool_name: name })
          }
          update({ toolsUsed: [...toolsUsed], circuits: [...circuits], snippets: [...snippets] })
        }

        update({ content, thinking, circuits, snippets, toolsUsed, streaming: false })
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
