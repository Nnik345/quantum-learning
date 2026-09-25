/** Shared types for the local-model layer. */

export interface ToolCall {
  function: { name: string; arguments: Record<string, unknown> }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** Reasoning, kept separate by Ollama so it never has to be parsed out of the text. */
  thinking?: string
  tool_calls?: ToolCall[]
  /** Set on role 'tool' so the model knows which call this answers. */
  tool_name?: string
}

/** One streamed delta. Content and thinking arrive pre-separated. */
export interface ChatChunk {
  content?: string
  thinking?: string
  toolCalls?: ToolCall[]
  done: boolean
  /** Present on the final chunk. */
  stats?: { promptTokens?: number; evalTokens?: number; totalMs?: number }
}

export interface ChatOptions {
  temperature?: number
  seed?: number
  numCtx?: number
}

export interface ChatRequest {
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  /** Reasoning is worth its latency for circuit work, not for conversation. */
  think?: boolean
  options?: ChatOptions
  signal?: AbortSignal
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** The wire format the model emits for a circuit — deliberately simpler than the internal one. */
export interface ProposedCircuit {
  numQubits: number
  /** Input preset per wire, defaulting to |0⟩. */
  inputs?: string[]
  gates: ProposedGate[]
  explanation?: string
}

export interface ProposedGate {
  gate: string
  targets: number[]
  controls?: number[]
  /** Single angle for RX/RY/RZ/P — every parametric gate here takes exactly one. */
  angle?: number
  column: number
}
