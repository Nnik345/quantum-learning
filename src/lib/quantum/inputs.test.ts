/** Per-wire input states, and multi-qubit gates on non-adjacent wires. */

import { describe, it, expect } from 'vitest'

import {
  DEFAULT_INPUT,
  INPUT_PRESETS,
  checkPlacement,
  circuitInputAmplitudes,
  createCircuit,
  hasDefaultInputs,
  inputKet,
  resizeInputs,
  resolveInput,
  spanOf,
  type Circuit,
  type Placement,
} from './circuit'
import { abs2 } from './complex'
import { SWAP_MATRIX, X_MATRIX } from './gates'
import { applyGate, basisLabel, blochVector, probabilities, productState, zeroState } from './state'
import { simulate, runShots } from './simulate'

const place = (over: Partial<Placement> & { gate: string; targets: number[] }): Placement => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  controls: [],
  params: [],
  column: 0,
  ...over,
})

function circuitWith(numQubits: number, over: Partial<Circuit> = {}): Circuit {
  return { ...createCircuit(numQubits, 8), ...over }
}

/** Label of the single basis state a deterministic circuit ends in. */
function soleKet(probs: Float64Array, n: number): string {
  const hits = [...probs].map((p, i) => ({ p, i })).filter(({ p }) => p > 1e-9)
  expect(hits).toHaveLength(1)
  return basisLabel(hits[0].i, n)
}

// --- presets ---------------------------------------------------------------

describe('input presets', () => {
  it('are all normalised', () => {
    for (const preset of INPUT_PRESETS) {
      const norm = abs2(preset.amplitudes[0]) + abs2(preset.amplitudes[1])
      expect(`${preset.id}:${norm.toFixed(12)}`).toBe(`${preset.id}:${(1).toFixed(12)}`)
    }
  })

  it('land on the six cardinal points of the Bloch sphere', () => {
    const expected: Record<string, [number, number, number]> = {
      '0': [0, 0, 1],
      '1': [0, 0, -1],
      '+': [1, 0, 0],
      '-': [-1, 0, 0],
      i: [0, 1, 0],
      '-i': [0, -1, 0],
    }
    for (const preset of INPUT_PRESETS) {
      const state = productState([preset.amplitudes])
      const b = blochVector(state, 0)
      const [x, y, z] = expected[preset.id]
      expect(`${preset.id} x`).toBe(`${preset.id} x`)
      expect(b.x).toBeCloseTo(x, 12)
      expect(b.y).toBeCloseTo(y, 12)
      expect(b.z).toBeCloseTo(z, 12)
      expect(b.length).toBeCloseTo(1, 12)
    }
  })

  it('labels each input for the wire gutter', () => {
    expect(inputKet({ preset: '+' })).toBe('|+⟩')
    expect(inputKet({ preset: '-i' })).toBe('|−i⟩')
    expect(inputKet({ preset: 'custom', source: ['1', '0'] })).toBe('|ψ⟩')
  })
})

// --- resolveInput ----------------------------------------------------------

describe('resolveInput', () => {
  it('accepts a normalised custom state', () => {
    const { amplitudes, error } = resolveInput({
      preset: 'custom',
      source: ['1/sqrt(2)', 'i/sqrt(2)'],
    })
    expect(error).toBeUndefined()
    expect(amplitudes![0].re).toBeCloseTo(Math.SQRT1_2, 12)
    expect(amplitudes![1].im).toBeCloseTo(Math.SQRT1_2, 12)
  })

  it('rejects an unnormalised state rather than silently rescaling it', () => {
    const { amplitudes, error } = resolveInput({ preset: 'custom', source: ['1', '1'] })
    expect(amplitudes).toBeUndefined()
    expect(error).toMatch(/not normalised/i)
    expect(error).toMatch(/2\.0/)
  })

  it('rejects the zero vector', () => {
    expect(resolveInput({ preset: 'custom', source: ['0', '0'] }).error).toMatch(/not normalised/i)
  })

  it('reports which amplitude failed to parse', () => {
    expect(resolveInput({ preset: 'custom', source: ['nonsense', '0'] }).error).toMatch(/^α:/)
    expect(resolveInput({ preset: 'custom', source: ['1', '1/(' ] }).error).toMatch(/^β:/)
  })

  it('accepts a state with a relative phase', () => {
    const { error, amplitudes } = resolveInput({
      preset: 'custom',
      source: ['1/sqrt(2)', 'e^(i*pi/3)/sqrt(2)'],
    })
    expect(error).toBeUndefined()
    expect(abs2(amplitudes![0]) + abs2(amplitudes![1])).toBeCloseTo(1, 12)
  })

  it('rejects an unknown preset', () => {
    expect(resolveInput({ preset: 'q' as never }).error).toMatch(/unknown input preset/i)
  })
})

// --- productState ----------------------------------------------------------

describe('productState', () => {
  it('matches zeroState when every wire is |0⟩', () => {
    const built = productState([
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    ])
    const zero = zeroState(2)
    expect([...built.re]).toEqual([...zero.re])
    expect([...built.im]).toEqual([...zero.im])
  })

  it('puts |01⟩ in the right place, respecting q0-is-leftmost ordering', () => {
    const state = productState([
      [{ re: 1, im: 0 }, { re: 0, im: 0 }], // q0 = |0⟩
      [{ re: 0, im: 0 }, { re: 1, im: 0 }], // q1 = |1⟩
    ])
    expect(soleKet(probabilities(state), 2)).toBe('01')
  })

  it('builds a separable superposition with the right cross terms', () => {
    const r = Math.SQRT1_2
    // |+⟩ ⊗ |+⟩ — all four basis states at 25%.
    const state = productState([
      [{ re: r, im: 0 }, { re: r, im: 0 }],
      [{ re: r, im: 0 }, { re: r, im: 0 }],
    ])
    for (const p of probabilities(state)) expect(p).toBeCloseTo(0.25, 12)
    // and it is genuinely separable: both Bloch vectors reach the surface.
    expect(blochVector(state, 0).length).toBeCloseTo(1, 12)
    expect(blochVector(state, 1).length).toBeCloseTo(1, 12)
  })
})

// --- inputs inside a circuit ----------------------------------------------

describe('circuit inputs', () => {
  it('defaults every wire to |0⟩', () => {
    const circuit = createCircuit(3)
    expect(circuit.inputs).toHaveLength(3)
    expect(hasDefaultInputs(circuit)).toBe(true)
  })

  it('feeds the initial state of the simulation', () => {
    const circuit = circuitWith(2, { inputs: [{ preset: '1' }, { preset: '0' }] })
    const { states, errors } = simulate(circuit)
    expect(errors).toEqual([])
    expect(soleKet(probabilities(states[0]), 2)).toBe('10')
  })

  it('lets a gate act on a non-|0⟩ input', () => {
    // X on a |1⟩ input returns it to |0⟩.
    const circuit = circuitWith(1, {
      inputs: [{ preset: '1' }],
      placements: [place({ gate: 'X', targets: [0], column: 0 })],
    })
    const { states } = simulate(circuit)
    expect(soleKet(probabilities(states[1]), 1)).toBe('0')
  })

  it('makes H|+⟩ = |0⟩', () => {
    const circuit = circuitWith(1, {
      inputs: [{ preset: '+' }],
      placements: [place({ gate: 'H', targets: [0], column: 0 })],
    })
    const { states } = simulate(circuit)
    expect(soleKet(probabilities(states[1]), 1)).toBe('0')
  })

  it('starts a |i⟩ input on the +y axis', () => {
    const circuit = circuitWith(1, { inputs: [{ preset: 'i' }] })
    const b = blochVector(simulate(circuit).states[0], 0)
    expect(b.y).toBeCloseTo(1, 12)
  })

  it('applies a custom input', () => {
    const circuit = circuitWith(1, {
      inputs: [{ preset: 'custom', source: ['sqrt(0.36)', 'sqrt(0.64)'] }],
    })
    const probs = probabilities(simulate(circuit).states[0])
    expect(probs[0]).toBeCloseTo(0.36, 12)
    expect(probs[1]).toBeCloseTo(0.64, 12)
  })

  it('falls back to |0⟩ and reports an invalid input instead of throwing', () => {
    const circuit = circuitWith(2, {
      inputs: [{ preset: 'custom', source: ['5', '5'] }, { preset: '1' }],
    })
    const { amplitudes, errors } = circuitInputAmplitudes(circuit)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/q0 input/)
    expect(amplitudes[0][0].re).toBe(1) // reverted to |0⟩

    const result = simulate(circuit)
    expect(result.errors[0]).toMatch(/q0 input/)
    expect(soleKet(probabilities(result.states[0]), 2)).toBe('01')
  })

  it('feeds shot sampling too', () => {
    const circuit = circuitWith(2, { inputs: [{ preset: '1' }, { preset: '1' }] })
    const { counts } = runShots(circuit, 128, 3)
    expect(counts).toEqual({ '11': 128 })
  })

  it('samples a |+⟩ input as a coin flip', () => {
    const circuit = circuitWith(1, { inputs: [{ preset: '+' }] })
    const { counts } = runShots(circuit, 2000, 11)
    expect(counts['0'] + counts['1']).toBe(2000)
    expect(counts['0']).toBeGreaterThan(850)
    expect(counts['0']).toBeLessThan(1150)
  })

  it('resizes the inputs array with the register', () => {
    const inputs = [{ preset: '1' as const }, { preset: '+' as const }]
    expect(resizeInputs(inputs, 4)).toEqual([...inputs, DEFAULT_INPUT, DEFAULT_INPUT])
    expect(resizeInputs(inputs, 1)).toEqual([{ preset: '1' }])
  })
})

// --- non-adjacent multi-qubit gates ---------------------------------------

describe('multi-qubit gates on non-adjacent wires', () => {
  it('swaps q0 and q2, leaving q1 alone', () => {
    const circuit = circuitWith(3, {
      inputs: [{ preset: '1' }, { preset: '0' }, { preset: '0' }],
      placements: [place({ gate: 'SWAP', targets: [0, 2], column: 0 })],
    })
    const { states, errors } = simulate(circuit)
    expect(errors).toEqual([])
    expect(soleKet(probabilities(states[0]), 3)).toBe('100')
    expect(soleKet(probabilities(states[1]), 3)).toBe('001')
  })

  it('accepts a non-adjacent SWAP as a legal placement', () => {
    const circuit = circuitWith(3)
    expect(checkPlacement(circuit, place({ gate: 'SWAP', targets: [0, 2] })).ok).toBe(true)
  })

  it('reserves the wires the link crosses', () => {
    const wide = place({ id: 'a', gate: 'SWAP', targets: [0, 2], column: 0 })
    expect(spanOf(wide)).toEqual({ top: 0, bottom: 2 })

    const circuit = circuitWith(3, { placements: [wide] })
    const blocked = checkPlacement(circuit, place({ gate: 'H', targets: [1], column: 0 }))
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toMatch(/SWAP already occupies q1 in this column/)
  })

  it('is its own inverse across distant wires', () => {
    const state = productState([
      [{ re: 0, im: 0 }, { re: 1, im: 0 }], // q0 = |1⟩
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    ])
    applyGate(state, SWAP_MATRIX, [0, 2])
    applyGate(state, SWAP_MATRIX, [0, 2])
    expect(soleKet(probabilities(state), 3)).toBe('100')
  })

  it('supports a controlled SWAP across non-adjacent wires (Fredkin)', () => {
    // Control q0; swap q1 and q3. With the control set, |1 1 0 0⟩ → |1 0 0 1⟩.
    const state = productState(
      ['1', '1', '0', '0'].map(
        (b) => (b === '1' ? [{ re: 0, im: 0 }, { re: 1, im: 0 }] : [{ re: 1, im: 0 }, { re: 0, im: 0 }]) as [
          { re: number; im: number },
          { re: number; im: number },
        ],
      ),
    )
    applyGate(state, SWAP_MATRIX, [1, 3], [0])
    expect(soleKet(probabilities(state), 4)).toBe('1001')
  })

  it('keeps target order meaningful for an asymmetric two-qubit gate', () => {
    // A CNOT written as a 2-qubit matrix: control is the gate's qubit 0.
    const cnot = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 1],
      [0, 0, 1, 0],
    ].map((row) => row.map((v) => ({ re: v, im: 0 })))

    // targets [0, 2]: control q0, flip q2. Start |1 0 0⟩ → |1 0 1⟩.
    const a = productState([
      [{ re: 0, im: 0 }, { re: 1, im: 0 }],
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    ])
    applyGate(a, cnot, [0, 2])
    expect(soleKet(probabilities(a), 3)).toBe('101')

    // targets [2, 0]: control q2 (which is |0⟩), so nothing happens.
    const b = productState([
      [{ re: 0, im: 0 }, { re: 1, im: 0 }],
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
      [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    ])
    applyGate(b, cnot, [2, 0])
    expect(soleKet(probabilities(b), 3)).toBe('100')
  })

  it('applies a plain X to a distant wire unchanged', () => {
    const state = zeroState(4)
    applyGate(state, X_MATRIX, [3])
    expect(soleKet(probabilities(state), 4)).toBe('0001')
  })
})

// --- sharing a control wire between gates ----------------------------------

describe('two gates sharing a control wire', () => {
  const cnot = (id: string, target: number, control: number, column: number): Placement =>
    place({ id, gate: 'X', targets: [target], controls: [control], column })

  it('allows it in different columns', () => {
    const circuit = circuitWith(4, { placements: [cnot('a', 1, 0, 0)] })
    expect(checkPlacement(circuit, cnot('b', 2, 0, 1)).ok).toBe(true)
  })

  it('refuses it in the same column, because the two links would coincide', () => {
    const circuit = circuitWith(4, { placements: [cnot('a', 1, 0, 0)] })
    const result = checkPlacement(circuit, cnot('b', 2, 0, 0))
    expect(result.ok).toBe(false)
    expect(result.reason).toMatch(/link from q0 to q2 would cross X/)
    expect(result.reason).toMatch(/another column/)
  })

  it('gives the same result either way, since the two gates commute', () => {
    // Both controlled by q0 and acting on disjoint targets, so column order is irrelevant.
    const inputs = [{ preset: '1' as const }, { preset: '0' as const }, { preset: '0' as const }, { preset: '0' as const }]
    const forward = circuitWith(4, { inputs, placements: [cnot('a', 1, 0, 0), cnot('b', 2, 0, 1)] })
    const reverse = circuitWith(4, { inputs, placements: [cnot('b', 2, 0, 0), cnot('a', 1, 0, 1)] })

    const f = simulate(forward)
    const r = simulate(reverse)
    expect(f.errors).toEqual([])
    expect(soleKet(probabilities(f.states[2]), 4)).toBe('1110')
    expect(soleKet(probabilities(r.states[2]), 4)).toBe('1110')
  })

  it('still allows many gates to share a control across successive columns', () => {
    const circuit = circuitWith(4, {
      inputs: [{ preset: '1' }, { preset: '0' }, { preset: '0' }, { preset: '0' }],
      placements: [cnot('a', 1, 0, 0), cnot('b', 2, 0, 1), cnot('c', 3, 0, 2)],
    })
    const { states, errors } = simulate(circuit)
    expect(errors).toEqual([])
    expect(soleKet(probabilities(states[3]), 4)).toBe('1111')
  })

  it('distinguishes a plain collision from a crossed link in the message', () => {
    const circuit = circuitWith(4, { placements: [place({ id: 'a', gate: 'H', targets: [1], column: 0 })] })

    // Single-wire candidate: a plain collision.
    const plain = checkPlacement(circuit, place({ gate: 'X', targets: [1], column: 0 }))
    expect(plain.reason).toMatch(/H already occupies q1 in this column/)

    // Spanning candidate: the link is what is blocked.
    const spanning = checkPlacement(circuit, place({ gate: 'X', targets: [2], controls: [0], column: 0 }))
    expect(spanning.reason).toMatch(/link from q0 to q2 would cross H/)
  })
})
