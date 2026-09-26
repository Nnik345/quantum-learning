/**
 * The assistant panel end to end, with the model replaced by a scripted fake.
 *
 * This exercises the real tool loop, the real validator and the real simulator — everything except
 * the network call — so the parts that decide whether a circuit is safe to show are covered without
 * needing Ollama running.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import type { ChatChunk, ChatRequest } from '../lib/llm/types'
import { DEFAULT_MODEL } from '../lib/llm/client'

/** Scripted turns: each entry is one model reply, consumed in order. */
let script: ChatChunk[][] = []
let lastRequest: ChatRequest | undefined
let health: { ok: boolean; error?: string; modelMissing?: boolean } = { ok: true }
/** What the daemon has pulled. The picker only appears with more than one. */
let pulled: { name: string; sizeBytes: number }[] = []
/** Every client the panel built, so a model choice can be checked where it actually lands. */
let built: { model?: string }[] = []
/** When set, a reply waits on it, so the UI can be inspected mid-request. */
let inFlight: Promise<void> | undefined

vi.mock('../lib/llm/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/llm/client')>()
  return {
    ...actual,
    OllamaClient: class {
      baseUrl = '/ollama'
      model = 'test-model'
      constructor(options: { model?: string } = {}) {
        built.push(options)
        if (options.model) this.model = options.model
      }
      async health() {
        return health
      }
      async listModels() {
        // Empty by default, so the picker stays out of every test that is not about it.
        return pulled
      }
      async *chat(request: ChatRequest) {
        lastRequest = request
        if (inFlight) await inFlight
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
  pulled = []
  built = []
  inFlight = undefined
  window.localStorage.removeItem('quantum-learning:model:v1')
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
    expect(system).toMatch(/they mean this page/)
    expect(system).toMatch(/get_current_page/)
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

// ---------------------------------------------------------------------------
// Resizing
//
// The panel is pinned bottom-right, so it grows up and to the left. That is why the handles sit on
// the top and left sides: a bottom-right grip would try to drag the panel off-screen.
//
// Three handles — top edge for height, left edge for width, corner for both. The edge cases below
// exist because a handle resizing an axis it does not own is the bug worth guarding against.
// ---------------------------------------------------------------------------

const { MIN_WIDTH, MIN_HEIGHT, PANEL_SIZE_KEY } = await import('./usePanelSize')

/** jsdom has no layout engine, so matchMedia must be stubbed to choose the desktop branch. */
function setViewport(desktop: boolean, width = 1440, height = 900) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: desktop,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

const corner = () => screen.getByRole('separator', { name: /from the corner/i })
const topEdge = () => screen.getByRole('separator', { name: /tutor height/i })
const leftEdge = () => screen.getByRole('separator', { name: /tutor width/i })
const panelBox = (container: HTMLElement) =>
  container.querySelector('[style*="width"]') as HTMLElement | null

/**
 * jsdom's synthetic pointerdown carries no coordinates, so the first move establishes the origin —
 * exactly as it does in a browser that behaves the same way. Hence two moves, not one.
 */
const drag = (el: HTMLElement, dx: number, dy: number) => {
  fireEvent.pointerDown(el, { clientX: 500, clientY: 300 })
  const move = (x: number, y: number) =>
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
    })
  move(500, 300) // sets the origin
  move(500 + dx, 300 + dy) // the actual drag
  act(() => {
    window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
  })
}

describe('resizing the panel', () => {
  beforeEach(() => {
    setViewport(true)
    // A remembered size is the feature, so without this each test inherits the last one's drag and
    // the suite only passes in the order it happens to run in.
    window.localStorage.removeItem(PANEL_SIZE_KEY)
  })

  it('starts at the shipped size', () => {
    const { container } = renderPanel()
    open()
    const box = panelBox(container)!
    expect(box.style.width).toBe(`${MIN_WIDTH}px`)
    expect(box.style.height).toBe(`${MIN_HEIGHT}px`)
  })

  it('grows when dragged up and to the left', () => {
    const { container } = renderPanel()
    open()
    drag(corner(), -160, -100)

    const box = panelBox(container)!
    expect(box.style.width).toBe(`${MIN_WIDTH + 160}px`)
    expect(box.style.height).toBe(`${MIN_HEIGHT + 100}px`)
  })

  it('refuses to shrink below the size it shipped with', () => {
    const { container } = renderPanel()
    open()
    // Dragging the other way would shrink it; the floor holds.
    drag(corner(), 300, 300)

    const box = panelBox(container)!
    expect(box.style.width).toBe(`${MIN_WIDTH}px`)
    expect(box.style.height).toBe(`${MIN_HEIGHT}px`)
  })

  it('will not grow past the viewport', () => {
    setViewport(true, 800, 700)
    const { container } = renderPanel()
    open()
    drag(corner(), -5000, -5000)

    const box = panelBox(container)!
    expect(Number.parseInt(box.style.width)).toBeLessThanOrEqual(800)
    expect(Number.parseInt(box.style.height)).toBeLessThanOrEqual(700)
  })

  it('resizes with the arrow keys, for anyone not using a pointer', () => {
    const { container } = renderPanel()
    open()
    fireEvent.keyDown(corner(), { key: 'ArrowLeft' })

    expect(Number.parseInt(panelBox(container)!.style.width)).toBeGreaterThan(MIN_WIDTH)
  })

  it('resets on double-click', () => {
    const { container } = renderPanel()
    open()
    drag(corner(), -200, -200)
    expect(Number.parseInt(panelBox(container)!.style.width)).toBeGreaterThan(MIN_WIDTH)

    fireEvent.doubleClick(corner())
    expect(panelBox(container)!.style.width).toBe(`${MIN_WIDTH}px`)
  })

  it('remembers the size across visits', () => {
    const first = renderPanel()
    open()
    drag(corner(), -120, -80)
    first.unmount()

    const second = renderPanel()
    open()
    const box = panelBox(second.container)!
    expect(box.style.width).toBe(`${MIN_WIDTH + 120}px`)
  })

  it('ignores a stored size that no longer fits the window', () => {
    window.localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify({ width: 9000, height: 9000 }))
    setViewport(true, 900, 800)
    const { container } = renderPanel()
    open()

    const box = panelBox(container)!
    expect(Number.parseInt(box.style.width)).toBeLessThanOrEqual(900)
  })

  it('survives corrupt stored size', () => {
    window.localStorage.setItem(PANEL_SIZE_KEY, 'not json')
    const { container } = renderPanel()
    open()
    expect(panelBox(container)!.style.width).toBe(`${MIN_WIDTH}px`)
  })

  it('changes only the height when the top edge is dragged', () => {
    const { container } = renderPanel()
    open()
    // Dragging diagonally: the horizontal component must be ignored by this handle.
    drag(topEdge(), -160, -100)

    const box = panelBox(container)!
    expect(box.style.height).toBe(`${MIN_HEIGHT + 100}px`)
    expect(box.style.width).toBe(`${MIN_WIDTH}px`)
  })

  it('changes only the width when the left edge is dragged', () => {
    const { container } = renderPanel()
    open()
    drag(leftEdge(), -160, -100)

    const box = panelBox(container)!
    expect(box.style.width).toBe(`${MIN_WIDTH + 160}px`)
    expect(box.style.height).toBe(`${MIN_HEIGHT}px`)
  })

  it('gives each edge only the arrow keys for its own axis', () => {
    const { container } = renderPanel()
    open()

    // The left edge answers to ArrowLeft and ignores ArrowUp.
    fireEvent.keyDown(leftEdge(), { key: 'ArrowLeft' })
    expect(Number.parseInt(panelBox(container)!.style.width)).toBeGreaterThan(MIN_WIDTH)
    fireEvent.keyDown(leftEdge(), { key: 'ArrowUp' })
    expect(panelBox(container)!.style.height).toBe(`${MIN_HEIGHT}px`)

    // And the top edge the other way round.
    fireEvent.keyDown(topEdge(), { key: 'ArrowUp' })
    expect(Number.parseInt(panelBox(container)!.style.height)).toBeGreaterThan(MIN_HEIGHT)
  })

  it('holds the floor on each edge independently', () => {
    const { container } = renderPanel()
    open()
    drag(topEdge(), 0, 400)
    drag(leftEdge(), 400, 0)

    const box = panelBox(container)!
    expect(box.style.width).toBe(`${MIN_WIDTH}px`)
    expect(box.style.height).toBe(`${MIN_HEIGHT}px`)
  })

  it('offers all three handles on a desktop, and none on a phone', () => {
    renderPanel()
    open()
    expect(screen.getAllByRole('separator', { name: /resize the tutor/i })).toHaveLength(3)

    cleanup()
    setViewport(false)
    renderPanel()
    open()
    expect(screen.queryByRole('separator', { name: /resize/i })).toBeNull()
  })
})

describe('choosing a model', () => {
  const THREE = [
    { name: 'qwen3.5:2b', sizeBytes: 2_700_000_000 },
    { name: 'qwen3.5:9b', sizeBytes: 6_600_000_000 },
    { name: 'qwen3.5:9b-q8_0', sizeBytes: 10_700_000_000 },
  ]

  it('says nothing when there is only one model to say it about', async () => {
    pulled = [{ name: 'qwen3.5:9b', sizeBytes: 6_600_000_000 }]
    renderPanel()
    open()
    await waitFor(() => expect(built.length).toBeGreaterThan(0))
    expect(screen.queryByLabelText('Model')).toBeNull()
  })

  it('offers every pulled model with the size that decides whether it fits', async () => {
    pulled = THREE
    renderPanel()
    open()

    const select = (await screen.findByLabelText('Model')) as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'qwen3.5:2b · 2.7 GB',
      'qwen3.5:9b · 6.6 GB',
      'qwen3.5:9b-q8_0 · 10.7 GB',
    ])
  })

  it('sends the choice to the client, and remembers it', async () => {
    pulled = THREE
    renderPanel()
    open()
    const select = await screen.findByLabelText('Model')

    fireEvent.change(select, { target: { value: 'qwen3.5:2b' } })

    // The point of the picker: the next request goes to the model that was picked.
    expect(built.at(-1)?.model).toBe('qwen3.5:2b')
    expect(window.localStorage.getItem('quantum-learning:model:v1')).toBe('qwen3.5:2b')
  })

  it('warns that a freshly chosen model has to load first', async () => {
    // Switching evicts the resident model, so the first reply stalls for tens of seconds on a card
    // that cannot hold both. Unexplained, that reads as a hang.
    pulled = THREE
    script = [text('A qubit is a two-level system.')]
    let release!: () => void
    inFlight = new Promise<void>((resolve) => (release = resolve))

    renderPanel()
    open()
    fireEvent.change(await screen.findByLabelText('Model'), {
      target: { value: 'qwen3.5:9b-q8_0' },
    })

    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), {
      target: { value: 'What is a qubit?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText(/loading qwen3.5:9b-q8_0, first reply will be slow/i)).toBeDefined()

    await act(async () => {
      release()
    })
    // Once a reply has arrived the model is resident, so the warning retires itself.
    expect(screen.queryByText(/first reply will be slow/i)).toBeNull()
  })
})
