/**
 * The validator is the trust boundary: everything a model emits passes through it before the site
 * shows or runs anything. These tests push malformed, hostile and merely-sloppy input at it and
 * check it never throws, never produces an illegal circuit, and always explains itself.
 */

import { describe, it, expect } from 'vitest'

import { validateProposal, summariseForModel, describeOutcome } from './validate'
import { ALGORITHM_PRESETS } from '../quantum/presets'
import { MAX_QUBITS } from '../quantum/state'
import { checkPlacement } from '../quantum/circuit'

const bell = {
  numQubits: 2,
  gates: [
    { gate: 'H', targets: [0], column: 0 },
    { gate: 'X', targets: [1], controls: [0], column: 1 },
  ],
}

describe('accepting good proposals', () => {
  it('builds a Bell state and computes what it really does', () => {
    const r = validateProposal(bell)
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.circuit!.placements).toHaveLength(2)

    // The outcome is computed, not taken from the model.
    expect(r.outcome!.probabilities.map((p) => p.label).sort()).toEqual(['00', '11'])
    expect(r.outcome!.probabilities[0].percent).toBeCloseTo(50, 6)
    expect(r.outcome!.entangled).toEqual([0, 1])
  })

  it('honours per-wire input presets', () => {
    const r = validateProposal({
      numQubits: 2,
      inputs: ['1', '0'],
      gates: [{ gate: 'I', targets: [0], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.outcome!.probabilities[0].label).toBe('10')
  })

  it('applies an angle to a parametric gate', () => {
    const r = validateProposal({
      numQubits: 1,
      gates: [{ gate: 'RY', targets: [0], angle: Math.PI, column: 0 }],
    })
    expect(r.ok).toBe(true)
    // RY(π) takes |0⟩ all the way to |1⟩.
    expect(r.outcome!.probabilities[0].label).toBe('1')
    expect(r.outcome!.probabilities[0].percent).toBeCloseTo(100, 6)
  })

  it('accepts multi-control gates', () => {
    const r = validateProposal({
      numQubits: 3,
      inputs: ['1', '1', '0'],
      gates: [{ gate: 'X', targets: [2], controls: [0, 1], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.outcome!.probabilities[0].label).toBe('111')
  })

  it('accepts a non-adjacent SWAP', () => {
    const r = validateProposal({
      numQubits: 3,
      inputs: ['1', '0', '0'],
      gates: [{ gate: 'SWAP', targets: [0, 2], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.outcome!.probabilities[0].label).toBe('001')
  })

  it('round-trips every shipped preset through the wire format', () => {
    for (const preset of ALGORITHM_PRESETS) {
      const proposal = {
        numQubits: preset.circuit.numQubits,
        inputs: preset.circuit.inputs.map((i) => i.preset),
        gates: preset.circuit.placements.map((p) => ({
          gate: p.gate,
          targets: p.targets,
          controls: p.controls,
          angle: p.params[0],
          column: p.column,
        })),
      }
      const r = validateProposal(proposal)
      expect(`${preset.id}: ${r.ok} ${r.errors.join()}`).toBe(`${preset.id}: true `)
      expect(r.circuit!.placements).toHaveLength(preset.circuit.placements.length)
    }
  })
})

describe('forgiving sloppy but recoverable output', () => {
  it('bumps a colliding gate to the next column, preserving order', () => {
    // A model often means "H then X on the same wire" but writes both in column 0.
    const r = validateProposal({
      numQubits: 1,
      gates: [
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'X', targets: [0], column: 0 },
      ],
    })
    expect(r.ok).toBe(true)
    expect(r.circuit!.placements.map((p) => [p.gate, p.column])).toEqual([
      ['H', 0],
      ['X', 1],
    ])
    expect(r.warnings.join()).toMatch(/Moved X from column 1 to 2/)
  })

  it('widens the register when a gate reaches past it', () => {
    const r = validateProposal({
      numQubits: 1,
      gates: [{ gate: 'X', targets: [2], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.circuit!.numQubits).toBe(3)
    expect(r.warnings.join()).toMatch(/Widened the register to 3/)
  })

  it('clamps an over-large register rather than failing', () => {
    const r = validateProposal({
      numQubits: 40,
      gates: [{ gate: 'H', targets: [0], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.circuit!.numQubits).toBe(MAX_QUBITS)
    expect(r.warnings.join()).toMatch(/at most 8/)
  })

  it('substitutes a default angle when a parametric gate has none', () => {
    const r = validateProposal({
      numQubits: 1,
      gates: [{ gate: 'RX', targets: [0], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.warnings.join()).toMatch(/no angle, used its default/)
  })

  it('falls back to |0⟩ for an unknown input preset', () => {
    const r = validateProposal({
      numQubits: 1,
      inputs: ['|psi>'],
      gates: [{ gate: 'I', targets: [0], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.warnings.join()).toMatch(/not a preset here/)
  })

  it('tolerates float columns and wire indices', () => {
    const r = validateProposal({
      numQubits: 2,
      gates: [{ gate: 'H', targets: [0.0], column: 1.0 }],
    })
    expect(r.ok).toBe(true)
  })
})

describe('rejecting what cannot be fixed', () => {
  const rejects = (input: unknown, pattern: RegExp) => {
    const r = validateProposal(input)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toMatch(pattern)
  }

  it('rejects a gate that does not exist here', () => {
    rejects(
      { numQubits: 2, gates: [{ gate: 'CCCZ', targets: [0], column: 0 }] },
      /not a gate on this platform/,
    )
  })

  it('rejects a register beyond the hard limit', () => {
    rejects({ numQubits: 2, gates: [{ gate: 'X', targets: [30], column: 0 }] }, /past the 8-qubit/)
  })

  it('rejects the wrong number of targets', () => {
    rejects(
      { numQubits: 2, gates: [{ gate: 'SWAP', targets: [0], column: 0 }] },
      /needs exactly 2 target/,
    )
  })

  it('rejects a wire used as both target and control', () => {
    rejects(
      { numQubits: 2, gates: [{ gate: 'X', targets: [0], controls: [0], column: 0 }] },
      /cannot be used twice|already a target/i,
    )
  })

  it('rejects an empty circuit', () => {
    rejects({ numQubits: 2, gates: [] }, /no gates/)
  })

  it('rejects missing or malformed fields without throwing', () => {
    for (const input of [
      null,
      undefined,
      42,
      'a circuit',
      {},
      { numQubits: 2 },
      { numQubits: 0, gates: [] },
      { numQubits: 2, gates: 'not an array' },
      { numQubits: 2, gates: [null, 7, { gate: 'H' }] },
      { numQubits: 2, gates: [{ targets: [0], column: 0 }] },
      { numQubits: 2, gates: [{ gate: 'H', targets: [], column: 0 }] },
      { numQubits: 2, gates: [{ gate: 'H', targets: [0], column: -3 }] },
      { numQubits: NaN, gates: [] },
    ]) {
      expect(() => validateProposal(input)).not.toThrow()
      expect(validateProposal(input).ok).toBe(false)
    }
  })

  it('refuses a controlled measurement', () => {
    rejects(
      { numQubits: 2, gates: [{ gate: 'MEASURE', targets: [0], controls: [1], column: 0 }] },
      /cannot be controlled/i,
    )
  })
})

describe('the produced circuit is always legal', () => {
  it('every placement passes checkPlacement independently', () => {
    const messy = {
      numQubits: 3,
      gates: [
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'X', targets: [2], controls: [0], column: 0 },
        { gate: 'SWAP', targets: [1, 2], column: 1 },
        { gate: 'RZ', targets: [1], angle: 0.3, column: 5 },
      ],
    }
    const r = validateProposal(messy)
    expect(r.circuit).toBeDefined()
    for (const p of r.circuit!.placements) {
      const check = checkPlacement(r.circuit!, p, p.id)
      expect(`${p.gate}@${p.column}: ${check.reason ?? 'ok'}`).toBe(`${p.gate}@${p.column}: ok`)
    }
  })

  it('never exceeds the qubit or column limits', () => {
    const r = validateProposal({
      numQubits: 99,
      gates: Array.from({ length: 30 }, (_, i) => ({ gate: 'H', targets: [0], column: i })),
    })
    expect(r.circuit!.numQubits).toBeLessThanOrEqual(MAX_QUBITS)
    expect(r.circuit!.columns).toBeLessThanOrEqual(64)
  })
})

describe('what gets reported back to the model', () => {
  it('states the computed result and the ordering convention', () => {
    const summary = summariseForModel(validateProposal(bell))
    expect(summary).toMatch(/^ACCEPTED/)
    expect(summary).toMatch(/0\.707\|00⟩/)
    expect(summary).toMatch(/Entangled qubits.*q0, q1/)
    expect(summary).toMatch(/q0 first \(leftmost\)/)
  })

  it('says entanglement is absent when it is', () => {
    const summary = summariseForModel(
      validateProposal({ numQubits: 2, gates: [{ gate: 'H', targets: [0], column: 0 }] }),
    )
    expect(summary).toMatch(/No entanglement/)
  })

  it('tells the model what to fix on rejection', () => {
    const summary = summariseForModel(
      validateProposal({ numQubits: 2, gates: [{ gate: 'NOPE', targets: [0], column: 0 }] }),
    )
    expect(summary).toMatch(/^REJECTED/)
    expect(summary).toMatch(/call the tool again/)
  })

  it('reports adjustments so the model can do better next time', () => {
    const summary = summariseForModel(validateProposal({ numQubits: 20, gates: bell.gates }))
    expect(summary).toMatch(/Adjustments made/)
  })
})

describe('describeOutcome', () => {
  it('matches the simulator on a known preset', () => {
    const grover = ALGORITHM_PRESETS.find((p) => p.id === 'grover')!
    const outcome = describeOutcome(grover.circuit)
    expect(outcome.probabilities).toHaveLength(1)
    expect(outcome.probabilities[0].label).toBe('11')
    expect(outcome.probabilities[0].percent).toBeCloseTo(100, 6)
  })
})

// ---------------------------------------------------------------------------
// Absorbing the idioms a model actually uses
//
// Both behaviours below were added in response to real failures: Qwen wrote "CZ" (a gate this
// palette spells as Z-with-a-control) and gave Hadamard two target wires at once. Rejecting either
// costs a whole retry round and teaches the model nothing.
// ---------------------------------------------------------------------------

describe('gate aliases', () => {
  it('reads CZ as Z with a control', () => {
    const r = validateProposal({
      numQubits: 2,
      inputs: ['1', '1'],
      gates: [{ gate: 'CZ', targets: [0, 1], column: 0 }],
    })
    expect(r.ok).toBe(true)
    const [p] = r.circuit!.placements
    expect(p.gate).toBe('Z')
    expect(p.controls).toEqual([0])
    expect(p.targets).toEqual([1])
    expect(r.warnings.join()).toMatch(/Read "CZ" as Z/)
  })

  it('reads CNOT as X with a control, and gets the direction right', () => {
    const r = validateProposal({
      numQubits: 2,
      inputs: ['1', '0'],
      gates: [{ gate: 'CNOT', targets: [0, 1], column: 0 }],
    })
    expect(r.ok).toBe(true)
    // Control q0 is |1⟩, so q1 flips: |10⟩ becomes |11⟩.
    expect(r.outcome!.probabilities[0].label).toBe('11')
  })

  it('reads Toffoli as X with two controls', () => {
    const r = validateProposal({
      numQubits: 3,
      inputs: ['1', '1', '0'],
      gates: [{ gate: 'toffoli', targets: [0, 1, 2], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.outcome!.probabilities[0].label).toBe('111')
  })

  it('reads Fredkin as a controlled SWAP', () => {
    const r = validateProposal({
      numQubits: 3,
      inputs: ['1', '1', '0'],
      gates: [{ gate: 'CSWAP', targets: [0, 1, 2], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.outcome!.probabilities[0].label).toBe('101')
  })

  it('leaves a real gate name alone', () => {
    const r = validateProposal({ numQubits: 1, gates: [{ gate: 'X', targets: [0], column: 0 }] })
    expect(r.ok).toBe(true)
    expect(r.warnings).toEqual([])
  })

  it('still rejects a name that is not an alias either', () => {
    const r = validateProposal({ numQubits: 1, gates: [{ gate: 'FOO', targets: [0], column: 0 }] })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toMatch(/"FOO" is not a gate/)
  })
})

describe('a one-qubit gate given several wires', () => {
  it('fans out to one gate per wire in the same column', () => {
    const r = validateProposal({
      numQubits: 3,
      gates: [{ gate: 'H', targets: [0, 1, 2], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.circuit!.placements).toHaveLength(3)
    expect(r.circuit!.placements.every((p) => p.gate === 'H' && p.column === 0)).toBe(true)
    // All three in superposition: eight equally likely outcomes.
    expect(r.outcome!.probabilities).toHaveLength(8)
    expect(r.warnings.join()).toMatch(/to each of q0, q1, q2 separately/)
  })

  it('does not fan out a genuinely two-qubit gate', () => {
    const r = validateProposal({
      numQubits: 2,
      inputs: ['1', '0'],
      gates: [{ gate: 'SWAP', targets: [0, 1], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.circuit!.placements).toHaveLength(1)
    expect(r.outcome!.probabilities[0].label).toBe('01')
  })

  it('does not fan out when controls are present, since that would change the meaning', () => {
    // X on [1,2] controlled by q0 is ambiguous; splitting it would silently invent a second gate.
    const r = validateProposal({
      numQubits: 3,
      gates: [{ gate: 'X', targets: [1, 2], controls: [0], column: 0 }],
    })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toMatch(/needs exactly 1 target/)
  })
})

describe('a symmetric gate written as controls only', () => {
  it('reads CZ with two controls and no target', () => {
    // CZ is drawn as two identical dots, so a model listing both wires as controls is being
    // faithful to the notation. One of them has to become the target here.
    const r = validateProposal({
      numQubits: 2,
      inputs: ['1', '1'],
      gates: [{ gate: 'CZ', targets: [], controls: [0, 1], column: 0 }],
    })
    expect(r.ok).toBe(true)
    const [p] = r.circuit!.placements
    expect(p.gate).toBe('Z')
    expect(p.controls).toEqual([0])
    expect(p.targets).toEqual([1])
  })

  it('reads CCZ with three controls and no target', () => {
    const r = validateProposal({
      numQubits: 3,
      inputs: ['1', '1', '1'],
      gates: [{ gate: 'CCZ', targets: [], controls: [0, 1, 2], column: 0 }],
    })
    expect(r.ok).toBe(true)
    expect(r.circuit!.placements[0].controls).toEqual([0, 1])
    expect(r.circuit!.placements[0].targets).toEqual([2])
  })

  it('still rejects a real gate with no targets at all', () => {
    const r = validateProposal({ numQubits: 2, gates: [{ gate: 'H', targets: [], column: 0 }] })
    expect(r.ok).toBe(false)
    expect(r.errors.join()).toMatch(/no target wires/)
  })
})
