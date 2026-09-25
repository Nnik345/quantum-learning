/**
 * The assistant panel end to end, with the model replaced by a scripted fake.
 *
 * This exercises the real tool loop, the real validator and the real simulator — everything except
 * the network call — so the parts that decide whether a circuit is safe to show are covered without
 * needing Ollama running.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { ChatChunk, ChatRequest } from '../lib/llm/types'
import { DEFAULT_MODEL } from '../lib/llm/client'

/** Scripted turns: each entry is one model reply, consumed in order. */
let script: ChatChunk[][] = []
let lastRequest: ChatRequest | undefined
let health: { ok: boolean; error?: string; modelMissing?: boolean } = { ok: true }

vi.mock('../lib/llm/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/llm/client')>()
  return {
    ...actual,
    OllamaClient: class {
      baseUrl = '/ollama'
      model = 'test-model'
      async health() {
        return health
      }
      async *chat(request: ChatRequest) {
        lastRequest = request
        const turn = script.shift() ?? [{ content: 'no script left', done: true }]
        for (const chunk of turn) yield chunk
      }
    },
  }
})

const { AssistantPanel } = await import('./AssistantPanel')
const bridge = await import('../circuit/circuitBridge')

const text = (s: string): ChatChunk[] => [{ content: s, done: false }, { done: true }]

const toolCall = (name: string, args: Record<string, unknown>): ChatChunk[] => [
  { toolCalls: [{ function: { name, arguments: args } }], done: true },
]

const renderPanel = (path = '/') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AssistantPanel />
    </MemoryRouter>,
  )

const open = () => fireEvent.click(screen.getByRole('button', { name: /open the tutor/i }))

async function ask(question: string) {
  fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: question } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  })
}

beforeEach(() => {
  script = []
  lastRequest = undefined
  health = { ok: true }
  bridge.unpublishCircuit()
  bridge.takePendingCircuit()
})

describe('opening and closing', () => {
  it('starts collapsed and does not contact the model', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /open the tutor/i })).toBeDefined()
    expect(lastRequest).toBeUndefined()
  })

  it('opens to suggestions and an honest disclaimer', () => {
    renderPanel()
    open()
    expect(screen.getByText(/Build a Bell state/)).toBeDefined()
    expect(screen.getByText(/can still get things wrong/i)).toBeDefined()
    // The welcome text also says which part IS dependable, and why.
    expect(screen.getByText(/run through the simulator before you see it/i)).toBeDefined()
  })

  it('keeps the disclaimer visible once a conversation has started', async () => {
    // The welcome text scrolls away after the first question — which is precisely when a reader is
    // most likely to take an answer at face value — so the warning lives under the composer too.
    script = [text('Qubits are two-level systems.')]
    renderPanel()
    open()
    expect(screen.getByText(/aims to be accurate but can still be wrong/i)).toBeDefined()

    await ask('what is a qubit')

    expect(await screen.findByText(/two-level systems/)).toBeDefined()
    expect(screen.queryByText(/Build a Bell state/)).toBeNull() // suggestions gone
    expect(screen.getByText(/aims to be accurate but can still be wrong/i)).toBeDefined()
  })
})

describe('answering a question', () => {
  it('streams a reply', async () => {
    script = [text('A qubit is a two-level quantum system.')]
    renderPanel()
    open()
    await ask('what is a qubit')

    expect(await screen.findByText(/two-level quantum system/)).toBeDefined()
  })

  it('passes the current page into the system prompt', async () => {
    script = [text('ok')]
    renderPanel('/algorithms/grovers-search')
    open()
    await ask('explain this')

    const system = lastRequest!.messages[0].content
    expect(system).toMatch(/Grover/)
    expect(system).toMatch(/assume they mean this page/)
  })

  it('always states the ordering convention to the model', async () => {
    script = [text('ok')]
    renderPanel()
    open()
    await ask('hello')
    expect(lastRequest!.messages[0].content).toMatch(/REVERSE of Qiskit/)
  })

  it('keeps reasoning off, including for build requests', async () => {
    // Deliberate, and measured rather than assumed: with Qwen3-14B the eval set scored 11/12 in
    // 102s with reasoning off against 10/12 in 936s with it on, and Grover never finished at all
    // with it on. See wantsDeepThinking for the numbers.
    renderPanel()
    open()

    script = [text('sure')]
    await ask('what is entanglement')
    expect(lastRequest!.think).toBe(false)

    script = [text('here you go')]
    await ask('build a Bell state')
    expect(lastRequest!.think).toBe(false)
  })

  it('hides reasoning behind a toggle', async () => {
    script = [[{ thinking: 'secret working', done: false }, { content: 'The answer.', done: true }]]
    renderPanel()
    open()
    await ask('why')

    expect(await screen.findByText('The answer.')).toBeDefined()
    expect(screen.queryByText(/secret working/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /show reasoning/i }))
    expect(screen.getByText(/secret working/)).toBeDefined()
  })
})

describe('tool use', () => {
  it('runs a tool, feeds the result back, and answers', async () => {
    script = [toolCall('search_content', { query: 'grover diffuser' }), text('It reflects about the mean.')]
    renderPanel()
    open()
    await ask('what does the diffuser do')

    expect(await screen.findByText(/reflects about the mean/)).toBeDefined()
    expect(screen.getByText(/used: search_content/)).toBeDefined()

    // The tool's output was handed back as a tool message.
    const toolMessage = lastRequest!.messages.find((m) => m.role === 'tool')
    expect(toolMessage?.content).toMatch(/grovers-search/)
  })

  it('renders a proposed circuit with the simulator’s own verdict', async () => {
    script = [
      toolCall('propose_circuit', {
        numQubits: 2,
        gates: [
          { gate: 'H', targets: [0], column: 0 },
          { gate: 'X', targets: [1], controls: [0], column: 1 },
        ],
      }),
      text('That is a Bell state.'),
    ]
    renderPanel()
    open()
    await ask('build a Bell state')

    expect(await screen.findByText(/That is a Bell state/)).toBeDefined()
    // The displayed result is computed, not quoted from the model.
    expect(screen.getByText(/0\.707\|00⟩ \+ 0\.707\|11⟩/)).toBeDefined()
    expect(screen.getByText(/entangled: q0, q1/)).toBeDefined()
  })

  it('does not render a circuit the validator rejected', async () => {
    script = [
      toolCall('propose_circuit', { numQubits: 2, gates: [{ gate: 'NOPE', targets: [0], column: 0 }] }),
      text('Sorry, that did not work.'),
    ]
    renderPanel()
    open()
    await ask('build something impossible')

    expect(await screen.findByText(/did not work/)).toBeDefined()
    expect(screen.queryByRole('button', { name: /Load into Circuit Lab/ })).toBeNull()
  })

  it('tells the model what to fix when a circuit is rejected', async () => {
    script = [
      toolCall('propose_circuit', { numQubits: 99, gates: [{ gate: 'H', targets: [0], column: 0 }] }),
      text('adjusted'),
    ]
    renderPanel()
    open()
    await ask('build a 99 qubit circuit')

    await screen.findByText('adjusted')
    const toolMessage = lastRequest!.messages.find((m) => m.role === 'tool')
    expect(toolMessage?.content).toMatch(/at most 8/)
  })

  it('reads the live board when one is published', async () => {
    const { getPreset } = await import('../lib/quantum/presets')
    bridge.publishCircuit(getPreset('bell')!.circuit, () => {})

    script = [toolCall('get_current_circuit', {}), text('You have a Bell state.')]
    renderPanel()
    open()
    await ask('what does my circuit do')

    await screen.findByText(/You have a Bell state/)
    const toolMessage = lastRequest!.messages.find((m) => m.role === 'tool')
    expect(toolMessage?.content).toMatch(/2 qubits, 2 gates/)
    expect(toolMessage?.content).toMatch(/Entangled qubits: q0, q1/)
  })
})

describe('loading a circuit onto the board', () => {
  const proposeBell = () => {
    script = [
      toolCall('propose_circuit', {
        numQubits: 2,
        gates: [
          { gate: 'H', targets: [0], column: 0 },
          { gate: 'X', targets: [1], controls: [0], column: 1 },
        ],
      }),
      text('done'),
    ]
  }

  it('loads straight onto a mounted board', async () => {
    const load = vi.fn()
    const { createCircuit } = await import('../lib/quantum/circuit')
    bridge.publishCircuit(createCircuit(2), load)

    proposeBell()
    renderPanel()
    open()
    await ask('build a Bell state')

    fireEvent.click(await screen.findByRole('button', { name: /Load into Circuit Lab/ }))
    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0][0].placements).toHaveLength(2)
    expect(screen.getByText(/Ctrl\+Z to undo/)).toBeDefined()
  })

  it('parks the circuit and offers a link when no board is mounted', async () => {
    proposeBell()
    renderPanel('/theory/entanglement')
    open()
    await ask('build a Bell state')

    fireEvent.click(await screen.findByRole('button', { name: /Load into Circuit Lab/ }))
    expect(screen.getByRole('link', { name: /open the lab/i })).toHaveAttribute('href', '/circuit')
    // The board will collect it on mount.
    expect(bridge.takePendingCircuit()?.placements).toHaveLength(2)
  })
})

describe('when Ollama is unavailable', () => {
  it('explains rather than hanging', async () => {
    health = { ok: false, error: 'Could not reach Ollama. Is the service running?' }
    renderPanel()
    open()

    expect(await screen.findByText(/Could not reach Ollama/)).toBeDefined()
  })

  it('tells you the pull command when the model is missing', async () => {
    health = { ok: false, modelMissing: true, error: 'Ollama is running but the model is not pulled.' }
    renderPanel()
    open()

    expect(await screen.findByText(/not pulled/)).toBeDefined()
    // The hint must name whatever model is configured, not a name frozen into the markup.
    expect(screen.getByText(new RegExp(`ollama pull ${DEFAULT_MODEL}`))).toBeDefined()
  })

  it('answers a question with an error instead of silence', async () => {
    health = { ok: false, error: 'Could not reach Ollama. Is the service running?' }
    renderPanel()
    open()
    await ask('anything')

    await waitFor(() => {
      expect(screen.getAllByText(/Could not reach Ollama/).length).toBeGreaterThan(0)
    })
  })
})

describe('the rest of the site is unaffected', () => {
  it('renders nothing intrusive when collapsed', () => {
    const { container } = renderPanel()
    // Just the launcher button.
    expect(container.querySelectorAll('button')).toHaveLength(1)
  })
})
