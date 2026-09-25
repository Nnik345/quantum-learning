/**
 * The Python guide, the playground, and the grading in between.
 *
 * The interesting assertions are about the task flow: a learner who writes correct Qiskit in their
 * own style must pass, and one whose program builds nothing must be told why rather than left
 * staring at silence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '../../App'
import { PYTHON_LESSONS } from '../../content/pythonLessons'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

const UP = { ok: true, qiskit: '2.5.2', python: '3.14.7', timeoutSeconds: 15, sandboxed: true }

/** Route /pyserver/health and /pyserver/run to canned replies. */
function mockService(replies: { health?: unknown; run?: unknown; down?: boolean }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (replies.down) throw new TypeError('Failed to fetch')
      const body = String(url).includes('/health') ? replies.health : replies.run
      return { ok: true, status: 200, json: async () => body } as Response
    }),
  )
}

/** A /run reply carrying a circuit, in Qiskit's own indices. */
const withCircuit = (numQubits: number, gates: unknown[]) => ({
  stdout: '',
  stderr: '',
  error: null,
  durationMs: 20,
  circuit: { numQubits, gates },
})

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('the Python hub', () => {
  it('leads with the guide and lists every lesson', () => {
    mockService({ health: UP })
    renderAt('/python')

    expect(screen.getByRole('link', { name: /start lesson 1/i })).toHaveAttribute(
      'href',
      `/python/${PYTHON_LESSONS[0].slug}`,
    )
    for (const lesson of PYTHON_LESSONS) {
      expect(screen.getAllByText(lesson.title).length).toBeGreaterThan(0)
    }
  })

  it('offers the playground for anyone who does not want a lesson', () => {
    mockService({ health: UP })
    renderAt('/python')
    expect(screen.getAllByRole('link', { name: /playground/i }).length).toBeGreaterThan(0)
  })

  it('says when the sandbox is on', async () => {
    mockService({ health: UP })
    renderAt('/python')
    expect(await screen.findByText(/sandboxed/i)).toBeDefined()
  })

  it('warns loudly when code would run unprotected', async () => {
    mockService({
      health: { ...UP, sandboxed: false, sandboxDetail: 'bubblewrap is not installed' },
    })
    renderAt('/python')

    // Someone about to share this page needs to know before they do, not after.
    // The heading is a <strong> inside the warning, so assert against the whole box.
    const warning = (await screen.findByText(/Not sandboxed/i)).parentElement!
    expect(warning.textContent).toMatch(/read and write/i)
    expect(warning.textContent).toMatch(/bubblewrap is not installed/i)
    expect(warning.textContent).toMatch(/before sharing/i)
  })

  it('reports the service version, and how to start it when it is down', async () => {
    mockService({ down: true })
    renderAt('/python')
    const notice = await screen.findByText(/The Python service is not running/)
    expect(notice.textContent).toMatch(/python pyserver\/server\.py/)
  })
})

describe('a guided lesson', () => {
  it('shows the reading and the task side by side', () => {
    mockService({ health: UP })
    renderAt('/python/first-circuit')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your first circuit')
    expect(screen.getByText('Your turn')).toBeDefined()
    expect(screen.getByRole('button', { name: /run and check/i })).toBeDefined()
  })

  it('marks a correct answer correct', async () => {
    // X on Qiskit qubit 0 of a 1-qubit register: exactly what the task asks for.
    mockService({ health: UP, run: withCircuit(1, [{ gate: 'X', targets: [0], column: 0 }]) })
    renderAt('/python/first-circuit')
    fireEvent.click(screen.getByRole('button', { name: /run and check/i }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/correct/i)
  })

  it('accepts a Bell pair built the other way round', async () => {
    // h(1) then cx(1,0) reaches the same state by a different route — still correct.
    mockService({
      health: UP,
      run: withCircuit(2, [
        { gate: 'H', targets: [1], column: 0 },
        { gate: 'CX', targets: [1, 0], column: 1 },
      ]),
    })
    renderAt('/python/entanglement')
    fireEvent.click(screen.getByRole('button', { name: /run and check/i }))

    expect((await screen.findByRole('status')).textContent).toMatch(/correct/i)
  })

  it('rejects a wrong answer and says what it produced instead', async () => {
    // A Hadamard where a bit flip was asked for.
    mockService({ health: UP, run: withCircuit(1, [{ gate: 'H', targets: [0], column: 0 }]) })
    renderAt('/python/first-circuit')
    fireEvent.click(screen.getByRole('button', { name: /run and check/i }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/not yet/i)
    expect(status.textContent).toMatch(/50\.0%/)
  })

  it('explains itself when the program builds no circuit at all', async () => {
    mockService({
      health: UP,
      run: { stdout: 'hello', stderr: '', error: null, durationMs: 5, circuit: null },
    })
    renderAt('/python/first-circuit')
    fireEvent.click(screen.getByRole('button', { name: /run and check/i }))

    const status = await screen.findByRole('status')
    expect(status.textContent).toMatch(/variable called/i)
  })

  it('surfaces a traceback as output', async () => {
    mockService({
      health: UP,
      run: { stdout: '', stderr: '', error: 'NameError: name “qc” is not defined', durationMs: 4 },
    })
    renderAt('/python/first-circuit')
    fireEvent.click(screen.getByRole('button', { name: /run and check/i }))
    expect(await screen.findByText(/NameError/)).toBeDefined()
  })

  it('offers a hint without giving the code away', () => {
    mockService({ health: UP })
    renderAt('/python/first-circuit')
    expect(screen.queryByText(/the bit-flip gate is/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^hint$/i }))
    // The hint names the gate and the shape of the call, but does not write the line for them.
    expect(screen.getByText(/the bit-flip gate is/i)).toBeDefined()
  })

  it('links forward, back, and to the quantum lesson behind it', () => {
    mockService({ health: UP })
    renderAt('/python/superposition')
    expect(screen.getByRole('link', { name: /Your first circuit/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /Measurement and shots/i })).toBeDefined()
    expect(screen.getByRole('link', { name: /quantum lesson behind this/i })).toBeDefined()
  })

  it('sends an unknown lesson back to the hub', () => {
    mockService({ health: UP })
    renderAt('/python/not-a-lesson')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Quantum computing in Python/i)
  })
})

describe('the playground', () => {
  it('runs code and shows what it printed', async () => {
    mockService({
      health: UP,
      run: { stdout: 'probabilities: 00 50%', stderr: '', error: null, durationMs: 42 },
    })
    renderAt('/python/playground')
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))

    expect(await screen.findByText(/probabilities:/)).toBeDefined()
    expect(screen.getByText('42 ms')).toBeDefined()
  })

  it('offers a returned circuit to the board, explaining the mirroring', async () => {
    mockService({
      health: UP,
      run: withCircuit(2, [
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'CX', targets: [0, 1], column: 1 },
      ]),
    })
    renderAt('/python/playground')
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))

    expect(await screen.findByRole('button', { name: /load into circuit lab/i })).toBeDefined()
    expect(screen.getByText(/mirrored/i)).toBeDefined()
  })

  it('refuses a circuit too wide for the board rather than crashing', async () => {
    mockService({ health: UP, run: withCircuit(9, []) })
    renderAt('/python/playground')
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /load into circuit lab/i })).toBeNull(),
    )
  })
})
