/**
 * Each algorithm circuit is checked against its textbook result.
 *
 * These circuits are shown to learners as worked examples, so a silent error here would teach
 * something false. Every preset is verified end to end rather than eyeballed.
 */

import { describe, it, expect } from 'vitest'

import { ALGORITHM_PRESETS, getPreset, type AlgorithmPreset } from './presets'
import { checkPlacement, type Circuit } from './circuit'
import { simulate, runShots } from './simulate'
import { blochVector, probabilities, basisLabel, type StateVector } from './state'

const preset = (id: string): AlgorithmPreset => {
  const p = getPreset(id)
  if (!p) throw new Error(`No preset "${id}"`)
  return p
}

const finalState = (c: Circuit): StateVector => {
  const { states, errors } = simulate(c)
  expect(errors).toEqual([])
  return states[states.length - 1]
}

/** Outcome distribution over the measured wires, as percentages keyed by bitstring. */
const outcomes = (c: Circuit, shots = 4000, seed = 7): Record<string, number> => {
  const { counts } = runShots(c, shots, seed)
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (v / shots) * 100]))
}

/** Probability of each basis label of the full register. */
function labelled(state: StateVector): Record<string, number> {
  const probs = probabilities(state)
  const out: Record<string, number> = {}
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > 1e-9) out[basisLabel(i, state.n)] = probs[i]
  }
  return out
}

// --- structural sanity, applied to every preset ----------------------------

describe('every preset is a legal, simulable circuit', () => {
  it.each(ALGORITHM_PRESETS.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    // Rebuild each placement against the others to confirm nothing overlaps.
    for (const placement of p.circuit.placements) {
      const check = checkPlacement(p.circuit, placement, placement.id)
      expect(`${p.id}/${placement.gate}@${placement.column}: ${check.reason ?? 'ok'}`).toBe(
        `${p.id}/${placement.gate}@${placement.column}: ok`,
      )
    }

    const { errors, states } = simulate(p.circuit)
    expect(errors).toEqual([])

    // Normalisation must survive the whole circuit.
    const total = [...probabilities(states[states.length - 1])].reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 10)

    expect(p.name.length).toBeGreaterThan(0)
    expect(p.summary.length).toBeGreaterThan(0)
  })

  it('has unique ids', () => {
    const ids = ALGORITHM_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has exactly the twelve algorithms, in teaching order', () => {
    expect(ALGORITHM_PRESETS.map((p) => p.id)).toEqual([
      'qrng',
      'bell',
      'superdense',
      'teleportation',
      'deutsch',
      'deutsch-jozsa',
      'bernstein-vazirani',
      'simon',
      'grover',
      'qft',
      'phase-estimation',
      'shor',
    ])
  })
})

// --- Tier 1: protocols -----------------------------------------------------

describe('quantum RNG', () => {
  it('is an even coin flip', () => {
    const dist = outcomes(preset('qrng').circuit, 4000, 1)
    expect(dist['0']).toBeGreaterThan(45)
    expect(dist['0']).toBeLessThan(55)
    expect(dist['0'] + dist['1']).toBeCloseTo(100, 6)
  })
})

describe('Bell state', () => {
  it('produces (|00⟩ + |11⟩)/√2', () => {
    const probs = labelled(finalState(preset('bell').circuit))
    expect(Object.keys(probs).sort()).toEqual(['00', '11'])
    expect(probs['00']).toBeCloseTo(0.5, 12)
    expect(probs['11']).toBeCloseTo(0.5, 12)
  })

  it('leaves both qubits maximally mixed — the signature of entanglement', () => {
    const state = finalState(preset('bell').circuit)
    expect(blochVector(state, 0).length).toBeCloseTo(0, 12)
    expect(blochVector(state, 1).length).toBeCloseTo(0, 12)
  })
})

describe('superdense coding', () => {
  it('recovers the two encoded bits exactly', () => {
    // The preset encodes 01 with an X on Alice's qubit.
    const probs = labelled(finalState(preset('superdense').circuit))
    expect(probs['01']).toBeCloseTo(1, 12)
  })

  it('recovers all four messages when the encoding gate is swapped out', () => {
    const base = preset('superdense').circuit
    const withEncoding = (gates: string[]): Circuit => ({
      ...base,
      placements: [
        ...base.placements.filter((p) => p.column !== 2),
        ...gates.map((gate, i) => ({
          id: `enc${i}`,
          gate,
          targets: [0],
          controls: [],
          params: [],
          column: 2,
        })),
      ],
    })

    // I → 00, X → 01, Z → 10, then Z·X → 11.
    expect(labelled(finalState(withEncoding([])))['00']).toBeCloseTo(1, 12)
    expect(labelled(finalState(withEncoding(['X'])))['01']).toBeCloseTo(1, 12)
    expect(labelled(finalState(withEncoding(['Z'])))['10']).toBeCloseTo(1, 12)

    // Z and X must land in different columns, so build that case explicitly.
    const zx: Circuit = {
      ...base,
      placements: [
        ...base.placements.filter((p) => p.column !== 2).map((p) => (p.column > 2 ? { ...p, column: p.column + 1 } : p)),
        { id: 'encX', gate: 'X', targets: [0], controls: [], params: [], column: 2 },
        { id: 'encZ', gate: 'Z', targets: [0], controls: [], params: [], column: 3 },
      ],
      columns: base.columns + 1,
    }
    expect(labelled(finalState(zx))['11']).toBeCloseTo(1, 12)
  })
})

describe('teleportation', () => {
  it('moves q0’s state onto q2', () => {
    const circuit = preset('teleportation').circuit
    const { states } = simulate(circuit)

    // q0 starts in |i⟩: Bloch vector (0, 1, 0).
    const before = blochVector(states[0], 0)
    expect(before.y).toBeCloseTo(1, 12)

    // After the protocol q2 carries that exact state.
    const after = blochVector(states[states.length - 1], 2)
    expect(after.x).toBeCloseTo(before.x, 10)
    expect(after.y).toBeCloseTo(before.y, 10)
    expect(after.z).toBeCloseTo(before.z, 10)
    expect(after.length).toBeCloseTo(1, 10)
  })

  it('works for any input state, not just the one shipped', () => {
    const base = preset('teleportation').circuit
    for (const p of ['0', '1', '+', '-', 'i', '-i'] as const) {
      const circuit: Circuit = { ...base, inputs: base.inputs.map((inp, q) => (q === 0 ? { preset: p } : inp)) }
      const { states } = simulate(circuit)
      const before = blochVector(states[0], 0)
      const after = blochVector(states[states.length - 1], 2)
      expect(`${p}:${after.x.toFixed(6)},${after.y.toFixed(6)},${after.z.toFixed(6)}`).toBe(
        `${p}:${before.x.toFixed(6)},${before.y.toFixed(6)},${before.z.toFixed(6)}`,
      )
    }
  })

  it('leaves q0 no longer holding the state — no cloning', () => {
    const circuit = preset('teleportation').circuit
    const { states } = simulate(circuit)
    const q0After = blochVector(states[states.length - 1], 0)
    // q0 has been rotated into the computational basis by the Bell measurement.
    expect(Math.abs(q0After.y)).toBeLessThan(1e-9)
  })
})

// --- Tier 2: oracles -------------------------------------------------------

describe('Deutsch', () => {
  it('reports 1 for a balanced oracle', () => {
    expect(outcomes(preset('deutsch').circuit)['1']).toBeCloseTo(100, 6)
  })

  it('reports 0 when the oracle is made constant', () => {
    const base = preset('deutsch').circuit
    // Dropping the CNOT makes f(x) = 0, which is constant.
    const constant: Circuit = { ...base, placements: base.placements.filter((p) => p.column !== 1) }
    expect(outcomes(constant)['0']).toBeCloseTo(100, 6)
  })
})

describe('Deutsch–Jozsa', () => {
  it('never returns all zeros for a balanced oracle', () => {
    const dist = outcomes(preset('deutsch-jozsa').circuit)
    expect(dist['000']).toBeUndefined()
  })

  it('returns the mask of the balanced function, 110', () => {
    expect(outcomes(preset('deutsch-jozsa').circuit)['110']).toBeCloseTo(100, 6)
  })

  it('returns all zeros when the oracle is constant', () => {
    const base = preset('deutsch-jozsa').circuit
    const constant: Circuit = {
      ...base,
      placements: base.placements.filter((p) => p.column !== 1 && p.column !== 2),
    }
    expect(outcomes(constant)['000']).toBeCloseTo(100, 6)
  })
})

describe('Bernstein–Vazirani', () => {
  it('recovers s = 1011 with certainty in one query', () => {
    expect(outcomes(preset('bernstein-vazirani').circuit)['1011']).toBeCloseTo(100, 6)
  })

  it('recovers a different hidden string when the oracle changes', () => {
    const base = preset('bernstein-vazirani').circuit
    // Rebuild the oracle for s = 0110: CNOTs from q1 and q2.
    const rebuilt: Circuit = {
      ...base,
      placements: [
        ...base.placements.filter((p) => p.column === 0 || p.column >= 4),
        { id: 'o1', gate: 'X', targets: [4], controls: [1], params: [], column: 1 },
        { id: 'o2', gate: 'X', targets: [4], controls: [2], params: [], column: 2 },
      ],
    }
    expect(outcomes(rebuilt)['0110']).toBeCloseTo(100, 6)
  })
})

describe('Simon', () => {
  it('only ever samples y with y·s = 0, for s = 11', () => {
    const dist = outcomes(preset('simon').circuit)
    // y·s mod 2 = y₀ + y₁ must be 0, so only 00 and 11 are possible.
    expect(Object.keys(dist).sort()).toEqual(['00', '11'])
    expect(dist['00'] + dist['11']).toBeCloseTo(100, 6)
  })

  it('samples the non-trivial y often enough to solve for s', () => {
    // y = 00 is useless; the run is only informative when y = 11 turns up.
    expect(outcomes(preset('simon').circuit)['11']).toBeGreaterThan(30)
  })
})

// --- Tier 3: amplitude and phase -------------------------------------------

describe('Grover', () => {
  it('finds the marked item with certainty after one iteration', () => {
    expect(outcomes(preset('grover').circuit)['11']).toBeCloseTo(100, 6)
  })

  it('is exact for N = 4 — no other outcome has any amplitude', () => {
    const probs = labelled(finalState(preset('grover').circuit))
    expect(Object.keys(probs)).toEqual(['11'])
  })
})

describe('QFT', () => {
  it('spreads any basis state evenly across all outcomes', () => {
    const probs = probabilities(finalState(preset('qft').circuit))
    expect(probs).toHaveLength(8)
    for (const p of probs) expect(p).toBeCloseTo(1 / 8, 12)
  })

  it('winds the phase at a rate set by the input', () => {
    const base = preset('qft').circuit
    const state = finalState(base)

    // Input |001⟩ = 1, so amplitude k carries phase 2πk/8 — each step is an eighth turn.
    for (let k = 0; k < 8; k++) {
      const expected = (2 * Math.PI * k) / 8
      const phase = Math.atan2(state.im[k], state.re[k])
      const diff = Math.abs(((phase - expected + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      expect(`k=${k} phase off by ${diff.toExponential(1)}`).toBe(`k=${k} phase off by ${(0).toExponential(1)}`)
    }
  })

  it('leaves |000⟩ as a flat, in-phase superposition', () => {
    const base = preset('qft').circuit
    const zeroInput: Circuit = { ...base, inputs: base.inputs.map(() => ({ preset: '0' as const })) }
    const state = finalState(zeroInput)
    for (let k = 0; k < 8; k++) {
      expect(state.re[k]).toBeCloseTo(Math.SQRT1_2 / 2, 12)
      expect(state.im[k]).toBeCloseTo(0, 12)
    }
  })
})

describe('phase estimation', () => {
  it('reads φ = 1/8 as the bitstring 001', () => {
    expect(outcomes(preset('phase-estimation').circuit)['001']).toBeCloseTo(100, 6)
  })

  it('reads φ = 1/4 as 010 when the gate is doubled to S', () => {
    const base = preset('phase-estimation').circuit
    // Double every controlled rotation: T (π/4) becomes S (π/2).
    const doubled: Circuit = {
      ...base,
      placements: base.placements.map((p) =>
        p.gate === 'P' && p.targets[0] === 3 ? { ...p, params: [p.params[0] * 2] } : p,
      ),
    }
    expect(outcomes(doubled)['010']).toBeCloseTo(100, 6)
  })

  it('reads φ = 0 as 000 when the phase gate does nothing', () => {
    const base = preset('phase-estimation').circuit
    const identity: Circuit = {
      ...base,
      placements: base.placements.map((p) =>
        p.gate === 'P' && p.targets[0] === 3 ? { ...p, params: [0] } : p,
      ),
    }
    expect(outcomes(identity)['000']).toBeCloseTo(100, 6)
  })
})

// --- Tier 4: Shor ----------------------------------------------------------

describe('Shor (N = 15, a = 4)', () => {
  it('only ever measures 000 or 100, giving period r = 2', () => {
    const dist = outcomes(preset('shor').circuit)
    expect(Object.keys(dist).sort()).toEqual(['000', '100'])
    // 100 is binary 0.100 = 1/2 = s/r with r = 2.
    expect(dist['100']).toBeGreaterThan(40)
    expect(dist['100']).toBeLessThan(60)
  })

  it('implements multiplication by 4 (mod 15) as a cyclic rotation', () => {
    // The work register starts at |0001⟩ = 1; one application must give |0100⟩ = 4.
    const base = preset('shor').circuit
    const justU: Circuit = {
      ...base,
      // Force the control on by starting q2 in |1⟩, and drop everything but the two SWAPs.
      inputs: base.inputs.map((inp, q) => (q === 2 ? { preset: '1' as const } : inp)),
      // Only the CONTROLLED swaps are the modular multiplier; the inverse QFT has a swap too.
      placements: base.placements.filter((p) => p.gate === 'SWAP' && p.controls.length > 0),
    }
    const probs = labelled(finalState(justU))
    // q0 q1 q2 = 001 (control), then the work register 0100 = 4.
    expect(Object.keys(probs)).toEqual(['0010100'])
  })

  it('leaves the work register alone when the control is off', () => {
    const base = preset('shor').circuit
    const controlOff: Circuit = {
      ...base,
      placements: base.placements.filter((p) => p.gate === 'SWAP' && p.controls.length > 0),
    }
    const probs = labelled(finalState(controlOff))
    // Nothing happens: still |0000001⟩.
    expect(Object.keys(probs)).toEqual(['0000001'])
  })

  it('gives factors of 15 from the recovered period', () => {
    // r = 2 and a = 4, so gcd(4 ± 1, 15) are the factors. Verified arithmetically here because
    // the classical post-processing is part of the algorithm the page describes.
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    expect(gcd(4 - 1, 15)).toBe(3)
    expect(gcd(4 + 1, 15)).toBe(5)
    expect(3 * 5).toBe(15)
  })
})
