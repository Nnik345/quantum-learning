/**
 * The Qiskit-to-site conversion, tested hardest.
 *
 * This is the one place in the feature where a wrong answer could hide silently: a mirrored circuit
 * still runs, still looks plausible, and quietly contradicts every lesson page. So the tests below
 * do not merely check the arithmetic — they check the PROPERTY the conversion exists for, which is
 * that after the flip, Qiskit and this site print the same bitstring for the same physical state.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

import { fromQiskitOrder, flipWire, type QiskitCircuit } from './qiskitOrder'
import { runPython, health, PythonUnavailable, PY_BASE } from './client'
import { validateProposal } from '../llm/validate'
import { finalState } from '../quantum/equivalence'
import { basisLabel, probabilities, MAX_QUBITS } from '../quantum/state'

/** The most likely basis label of a converted circuit, as the site would print it. */
function siteLabel(circuit: QiskitCircuit): string {
  const { proposal, errors } = fromQiskitOrder(circuit)
  expect(errors).toEqual([])
  const result = validateProposal(proposal)
  expect(result.errors).toEqual([])

  const state = finalState(result.circuit!)
  const probs = probabilities(state)
  let best = 0
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i
  return basisLabel(best, state.n)
}

const qiskit = (numQubits: number, gates: QiskitCircuit['gates']): QiskitCircuit => ({
  numQubits,
  gates,
})

describe('flipWire', () => {
  it('is a reflection, so applying it twice is the identity', () => {
    for (let n = 1; n <= MAX_QUBITS; n++) {
      for (let w = 0; w < n; w++) expect(flipWire(n, flipWire(n, w))).toBe(w)
    }
  })

  it('sends Qiskit qubit 0 to the bottom wire', () => {
    expect(flipWire(3, 0)).toBe(2)
    expect(flipWire(3, 2)).toBe(0)
    expect(flipWire(1, 0)).toBe(0)
  })
})

describe('the conversion makes both conventions print the same bitstring', () => {
  /*
   * Each case states what REAL Qiskit prints for that program. If the conversion is wrong, the
   * site's label comes out mirrored and these fail — which is the entire point.
   */
  it.each([
    // [description, qiskit circuit, what Qiskit prints]
    ['x(0) on 3 qubits', qiskit(3, [{ gate: 'X', targets: [0], column: 0 }]), '001'],
    ['x(2) on 3 qubits', qiskit(3, [{ gate: 'X', targets: [2], column: 0 }]), '100'],
    ['x(1) on 2 qubits', qiskit(2, [{ gate: 'X', targets: [1], column: 0 }]), '10'],
    ['x(0) on 2 qubits', qiskit(2, [{ gate: 'X', targets: [0], column: 0 }]), '01'],
    [
      'x(0) then x(1) on 3 qubits',
      qiskit(3, [
        { gate: 'X', targets: [0], column: 0 },
        { gate: 'X', targets: [1], column: 1 },
      ]),
      '011',
    ],
    [
      'cx(0,1) after x(0) — control fires',
      qiskit(3, [
        { gate: 'X', targets: [0], column: 0 },
        { gate: 'CX', targets: [0, 1], column: 1 },
      ]),
      '011',
    ],
    [
      'cx(0,1) with control low — nothing happens',
      qiskit(3, [{ gate: 'CX', targets: [0, 1], column: 0 }]),
      '000',
    ],
    [
      'ccx(0,1,2) with both controls set',
      qiskit(3, [
        { gate: 'X', targets: [0], column: 0 },
        { gate: 'X', targets: [1], column: 1 },
        { gate: 'CCX', targets: [0, 1, 2], column: 2 },
      ]),
      '111',
    ],
  ])('%s prints %s in both', (_name, circuit, expected) => {
    expect(siteLabel(circuit)).toBe(expected)
  })

  it('keeps control and target distinct rather than swapping them', () => {
    // cx(0,1) fires on qubit 0 and writes qubit 1. If the pairing were reversed, setting qubit 0
    // would leave the register at 001 instead of 011.
    const controlSet = qiskit(2, [
      { gate: 'X', targets: [0], column: 0 },
      { gate: 'CX', targets: [0, 1], column: 1 },
    ])
    const targetSet = qiskit(2, [
      { gate: 'X', targets: [1], column: 0 },
      { gate: 'CX', targets: [0, 1], column: 1 },
    ])
    expect(siteLabel(controlSet)).toBe('11')
    expect(siteLabel(targetSet)).toBe('10') // control is low, so the target is untouched
  })
})

describe('the conversion refuses what it cannot represent', () => {
  it('rejects a qubit index outside the register instead of wrapping it', () => {
    const { errors } = fromQiskitOrder(qiskit(2, [{ gate: 'X', targets: [5], column: 0 }]))
    expect(errors.join(' ')).toMatch(/outside/i)
  })

  it('rejects a circuit wider than the simulator', () => {
    const { proposal, errors } = fromQiskitOrder(qiskit(MAX_QUBITS + 1, []))
    expect(proposal).toBeUndefined()
    expect(errors.join(' ')).toMatch(new RegExp(`${MAX_QUBITS}`))
  })

  it('rejects a circuit with no qubits', () => {
    expect(fromQiskitOrder(qiskit(0, [])).errors).toHaveLength(1)
  })

  it('drops only the offending gate, keeping the rest', () => {
    const { proposal } = fromQiskitOrder(
      qiskit(2, [
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'X', targets: [9], column: 1 },
      ]),
    )
    expect(proposal?.gates).toHaveLength(1)
    expect(proposal?.gates[0].gate).toBe('H')
  })
})

describe('converted circuits survive the existing validator', () => {
  it('expands Qiskit alias names into this platform’s gates', () => {
    const { proposal } = fromQiskitOrder(
      qiskit(3, [
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'CX', targets: [0, 1], column: 1 },
        { gate: 'CZ', targets: [1, 2], column: 2 },
        { gate: 'CP', targets: [0, 2], angle: Math.PI / 2, column: 3 },
        { gate: 'MEASURE', targets: [0], column: 4 },
      ]),
    )
    const result = validateProposal(proposal)
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)

    const byGate = result.circuit!.placements.map((p) => `${p.gate}/${p.controls.length}`)
    expect(byGate).toContain('X/1') // CX became X with a control
    expect(byGate).toContain('Z/1')
    expect(byGate).toContain('P/1')
    expect(byGate).toContain('MEASURE/0')
  })

  it('carries the angle through on a parametrised gate', () => {
    const { proposal } = fromQiskitOrder(
      qiskit(1, [{ gate: 'RZ', targets: [0], angle: Math.PI / 4, column: 0 }]),
    )
    const result = validateProposal(proposal)
    expect(result.circuit!.placements[0].params[0]).toBeCloseTo(Math.PI / 4)
  })
})

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

afterEach(() => vi.unstubAllGlobals())

const stubFetch = (impl: (url: string) => unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const value = impl(String(url))
      if (value instanceof Error) throw value
      return { ok: true, status: 200, json: async () => value } as Response
    }),
  )

describe('the API prefix cannot shadow a page route', () => {
  it('is not a prefix of any route the app serves', () => {
    // Vite matches proxy rules by prefix. `/py` would capture `/python` and serve the service's
    // error page instead of the app — which is exactly what happened before this was renamed.
    const routes = ['/', '/path', '/reference', '/circuit', '/python', '/math', '/theory', '/algorithms']
    for (const route of routes) {
      expect(route.startsWith(PY_BASE), `${PY_BASE} shadows ${route}`).toBe(false)
    }
  })
})

describe('the Python client', () => {
  it('reports the Qiskit version when the service is up', async () => {
    stubFetch(() => ({ ok: true, qiskit: '2.5.2', python: '3.14.7' }))
    expect((await health()).qiskit).toBe('2.5.2')
  })

  it('treats an unreachable service as a state, not a crash', async () => {
    stubFetch(() => new TypeError('Failed to fetch'))
    const result = await health()
    expect(result.ok).toBe(false)
    // The reader is told how to fix it rather than just that something went wrong.
    expect(result.error).toMatch(/pyserver\/server\.py/)
  })

  it('throws a named error from runPython when the service is down', async () => {
    stubFetch(() => new TypeError('Failed to fetch'))
    await expect(runPython('print(1)')).rejects.toBeInstanceOf(PythonUnavailable)
  })

  it('returns a traceback as a result rather than throwing', async () => {
    stubFetch(() => ({ stdout: '', stderr: '', error: 'NameError: name “qc” is not defined', durationMs: 12 }))
    const run = await runPython('qc')
    expect(run.error).toMatch(/NameError/)
  })
})
