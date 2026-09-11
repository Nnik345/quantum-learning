/**
 * Behavioural tests for circuit editing: placement rules, controls, undo/redo and persistence.
 * These drive the real hook, so they cover what the UI actually calls rather than a reimplementation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useCircuitStore } from './useCircuitStore'
import { STORAGE_KEY, deserialiseCircuit, loadFromStorage } from '../lib/quantum/persist'
import { hasDefaultInputs, serialiseCircuit, spanOf, type Circuit } from '../lib/quantum/circuit'
import { simulate } from '../lib/quantum/simulate'
import { probabilities } from '../lib/quantum/state'
import { parseComplex } from '../lib/quantum/parseComplex'
import type { CustomGate } from '../lib/quantum/gates'

beforeEach(() => window.localStorage.clear())

describe('useCircuitStore — placing gates', () => {
  it('starts empty with a default register', () => {
    const { result } = renderHook(() => useCircuitStore())
    expect(result.current.circuit.numQubits).toBe(3)
    expect(result.current.circuit.placements).toHaveLength(0)
  })

  it('places a gate on the requested wire and column', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => {
      result.current.addGate('H', 1, 2)
    })
    const [p] = result.current.circuit.placements
    expect(p.gate).toBe('H')
    expect(p.targets).toEqual([1])
    expect(p.column).toBe(2)
  })

  it('gives a two-qubit gate adjacent wires, flipping upward at the bottom edge', () => {
    const { result } = renderHook(() => useCircuitStore())

    act(() => {
      result.current.addGate('SWAP', 0, 0)
    })
    expect(result.current.circuit.placements[0].targets).toEqual([0, 1])

    // Dropped on the last wire there is no room below, so it takes the wires above.
    act(() => {
      result.current.addGate('SWAP', 2, 1)
    })
    expect(result.current.circuit.placements[1].targets).toEqual([1, 2])
  })

  it('refuses to stack two gates on the same cell', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => {
      result.current.addGate('H', 0, 0)
    })
    act(() => {
      result.current.addGate('X', 0, 0)
    })
    expect(result.current.circuit.placements).toHaveLength(1)
    expect(result.current.lastError).toMatch(/H already occupies q0 in this column/)
  })

  it('refuses a gate dropped under a control line', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('X', 2, 0)
    })
    act(() => {
      result.current.toggleControl(id!, 0)
    })
    // The gate now spans wires 0..2, so wire 1 in that column is occupied.
    expect(spanOf(result.current.circuit.placements[0])).toEqual({ top: 0, bottom: 2 })

    act(() => {
      result.current.addGate('H', 1, 0)
    })
    expect(result.current.circuit.placements).toHaveLength(1)
  })

  it('applies default parameters to a rotation gate', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => {
      result.current.addGate('RX', 0, 0)
    })
    expect(result.current.circuit.placements[0].params).toEqual([Math.PI / 2])
  })
})

describe('useCircuitStore — moving and deleting', () => {
  it('moves a gate to a new cell', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('H', 0, 0)
    })
    act(() => {
      result.current.moveGate(id!, 2, 3)
    })
    const [p] = result.current.circuit.placements
    expect(p.targets).toEqual([2])
    expect(p.column).toBe(3)
  })

  it('moves a controlled gate rigidly, preserving the control offset', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('X', 1, 0)
    })
    act(() => {
      result.current.toggleControl(id!, 0)
    })
    // Span is wires 0..1; moving the top wire to 1 should put target on 2.
    act(() => {
      result.current.moveGate(id!, 1, 2)
    })
    const [p] = result.current.circuit.placements
    expect(p.controls).toEqual([1])
    expect(p.targets).toEqual([2])
    expect(p.column).toBe(2)
  })

  it('refuses a move that would fall off the register', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('SWAP', 0, 0)
    })
    let ok = true
    act(() => {
      ok = result.current.moveGate(id!, 2, 0) // needs wires 2 and 3, only 0..2 exist
    })
    expect(ok).toBe(false)
    expect(result.current.circuit.placements[0].targets).toEqual([0, 1])
  })

  it('deletes a gate', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('H', 0, 0)
    })
    act(() => {
      result.current.removeGate(id!)
    })
    expect(result.current.circuit.placements).toHaveLength(0)
  })
})

describe('useCircuitStore — controls', () => {
  it('adds and removes a control on the same wire', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('X', 1, 0)
    })
    act(() => {
      result.current.toggleControl(id!, 0)
    })
    expect(result.current.circuit.placements[0].controls).toEqual([0])

    act(() => {
      result.current.toggleControl(id!, 0)
    })
    expect(result.current.circuit.placements[0].controls).toEqual([])
  })

  it('refuses a control on the gate’s own target wire', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('X', 1, 0)
    })
    act(() => {
      result.current.toggleControl(id!, 1)
    })
    expect(result.current.circuit.placements[0].controls).toEqual([])
    expect(result.current.lastError).toMatch(/already a target/i)
  })

  it('supports multiple controls, producing a Toffoli', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      result.current.addGate('X', 0, 0)
      result.current.addGate('X', 1, 0)
    })
    act(() => {
      id = result.current.addGate('X', 2, 1)
    })
    act(() => {
      result.current.toggleControl(id!, 0)
    })
    act(() => {
      result.current.toggleControl(id!, 1)
    })

    const { states } = simulate(result.current.circuit)
    const final = states[states.length - 1]
    // |111⟩ is index 0b111 = 7.
    expect(probabilities(final)[7]).toBeCloseTo(1, 12)
  })
})

describe('useCircuitStore — undo/redo', () => {
  it('undoes and redoes a placement', () => {
    const { result } = renderHook(() => useCircuitStore())
    expect(result.current.canUndo).toBe(false)

    act(() => {
      result.current.addGate('H', 0, 0)
    })
    expect(result.current.canUndo).toBe(true)

    act(() => result.current.undo())
    expect(result.current.circuit.placements).toHaveLength(0)
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(result.current.circuit.placements).toHaveLength(1)
  })

  it('drops the redo stack once a new edit is made', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => {
      result.current.addGate('H', 0, 0)
    })
    act(() => result.current.undo())
    act(() => {
      result.current.addGate('X', 1, 0)
    })
    expect(result.current.canRedo).toBe(false)
  })

  it('undoes a qubit-count change including the placements it pruned', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => {
      result.current.addGate('H', 2, 0)
    })
    act(() => result.current.setNumQubits(2))
    expect(result.current.circuit.placements).toHaveLength(0) // wire 2 no longer exists

    act(() => result.current.undo())
    expect(result.current.circuit.numQubits).toBe(3)
    expect(result.current.circuit.placements).toHaveLength(1)
  })
})

describe('useCircuitStore — register size', () => {
  it('clamps the qubit count to the supported range', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.setNumQubits(99))
    expect(result.current.circuit.numQubits).toBe(8)
    act(() => result.current.setNumQubits(0))
    expect(result.current.circuit.numQubits).toBe(1)
  })

  it('renumbers placements when a column is inserted', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => {
      result.current.addGate('H', 0, 2)
    })
    act(() => result.current.addColumnAt(1))
    expect(result.current.circuit.placements[0].column).toBe(3)
  })

  it('removes a column and shifts later placements back', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => {
      result.current.addGate('H', 0, 1)
      result.current.addGate('X', 0, 3)
    })
    act(() => result.current.removeColumnAt(1))
    expect(result.current.circuit.placements.map((p) => [p.gate, p.column])).toEqual([['X', 2]])
  })
})

describe('useCircuitStore — custom gates', () => {
  const myHadamard: CustomGate = {
    id: 'myh',
    label: 'Ĥ',
    name: 'My Hadamard',
    arity: 1,
    source: [
      ['1/sqrt(2)', '1/sqrt(2)'],
      ['1/sqrt(2)', '-1/sqrt(2)'],
    ],
    matrix: [
      ['1/sqrt(2)', '1/sqrt(2)'],
      ['1/sqrt(2)', '-1/sqrt(2)'],
    ].map((row) => row.map(parseComplex)),
  }

  it('places a custom gate and simulates it like the built-in equivalent', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.addCustomGate(myHadamard))
    act(() => {
      result.current.addGate('custom:myh', 0, 0)
    })

    const { states, errors } = simulate(result.current.circuit)
    expect(errors).toEqual([])
    const probs = probabilities(states[1])
    // |0⟩ and |1⟩ on q0, both other qubits untouched → indices 0 and 0b100.
    expect(probs[0]).toBeCloseTo(0.5, 12)
    expect(probs[0b100]).toBeCloseTo(0.5, 12)
  })

  it('removes the gate’s placements when the gate itself is deleted', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.addCustomGate(myHadamard))
    act(() => {
      result.current.addGate('custom:myh', 0, 0)
      result.current.addGate('H', 1, 0)
    })
    act(() => result.current.removeCustomGate('myh'))

    expect(result.current.circuit.customGates.myh).toBeUndefined()
    expect(result.current.circuit.placements.map((p) => p.gate)).toEqual(['H'])
  })
})

describe('persistence', () => {
  it('round-trips a circuit through serialise and deserialise', () => {
    const original: Circuit = {
      numQubits: 3,
      columns: 8,
      customGates: {},
      inputs: [{ preset: '1' }, { preset: '+' }, { preset: 'custom', source: ['1/sqrt(2)', '-i/sqrt(2)'] }],
      placements: [
        { id: 'a', gate: 'H', targets: [0], controls: [], params: [], column: 0 },
        { id: 'b', gate: 'X', targets: [1], controls: [0], params: [], column: 1 },
        { id: 'c', gate: 'RZ', targets: [2], controls: [], params: [0.75], column: 2 },
      ],
    }
    const { circuit, warnings } = deserialiseCircuit(JSON.parse(JSON.stringify(serialiseCircuit(original))))
    expect(warnings).toEqual([])
    expect(circuit.placements).toEqual(original.placements)
    expect(circuit.numQubits).toBe(3)
    expect(circuit.inputs).toEqual(original.inputs)
  })

  it('re-validates custom gates on load and drops non-unitary ones', () => {
    const { circuit, warnings } = deserialiseCircuit({
      version: 1,
      numQubits: 2,
      columns: 4,
      placements: [{ id: 'a', gate: 'custom:bad', targets: [0], controls: [], params: [], column: 0 }],
      customGates: {
        bad: { id: 'bad', label: 'B', name: 'Bad', arity: 1, source: [['1', '1'], ['1', '1']] },
      },
    })
    expect(circuit.customGates.bad).toBeUndefined()
    expect(circuit.placements).toHaveLength(0)
    expect(warnings.join(' ')).toMatch(/not unitary/i)
  })

  it('salvages a partly corrupt file rather than failing entirely', () => {
    const { circuit, warnings } = deserialiseCircuit({
      version: 1,
      numQubits: 2,
      columns: 6,
      placements: [
        { id: 'good', gate: 'H', targets: [0], controls: [], params: [], column: 0 },
        { id: 'offgrid', gate: 'X', targets: [9], controls: [], params: [], column: 0 },
        'not an object',
      ],
      customGates: {},
    })
    expect(circuit.placements.map((p) => p.id)).toEqual(['good'])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('returns an empty circuit for junk input', () => {
    expect(deserialiseCircuit(null).circuit.placements).toEqual([])
    expect(deserialiseCircuit(42).circuit.numQubits).toBe(3)
  })

  it('autosaves after an edit and restores on remount', async () => {
    vi.useFakeTimers()
    try {
      const first = renderHook(() => useCircuitStore())
      act(() => {
        first.result.current.addGate('H', 1, 2)
      })
      await act(async () => {
        vi.advanceTimersByTime(600)
      })
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy()

      const restored = loadFromStorage()
      expect(restored?.circuit.placements[0]).toMatchObject({ gate: 'H', targets: [1], column: 2 })
    } finally {
      vi.useRealTimers()
    }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useCircuitStore — qubit inputs', () => {
  it('sets a wire input and feeds it into the simulation', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.setQubitInput(0, { preset: '1' }))

    expect(result.current.circuit.inputs[0]).toEqual({ preset: '1' })
    const { states } = simulate(result.current.circuit)
    expect(probabilities(states[0])[0b100]).toBeCloseTo(1, 12)
  })

  it('accepts a custom input and rejects nothing silently', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() =>
      result.current.setQubitInput(1, { preset: 'custom', source: ['sqrt(0.25)', 'sqrt(0.75)'] }),
    )
    const { states, errors } = simulate(result.current.circuit)
    expect(errors).toEqual([])
    expect(probabilities(states[0])[0b000]).toBeCloseTo(0.25, 12)
    expect(probabilities(states[0])[0b010]).toBeCloseTo(0.75, 12)
  })

  it('resets every input to |0⟩', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.setQubitInput(0, { preset: '+' }))
    act(() => result.current.setQubitInput(2, { preset: '-i' }))
    expect(hasDefaultInputs(result.current.circuit)).toBe(false)

    act(() => result.current.resetInputs())
    expect(hasDefaultInputs(result.current.circuit)).toBe(true)
  })

  it('is undoable', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.setQubitInput(0, { preset: '1' }))
    act(() => result.current.undo())
    expect(result.current.circuit.inputs[0]).toEqual({ preset: '0' })
  })

  it('keeps the inputs array in step with the qubit count', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.setQubitInput(1, { preset: '+' }))

    act(() => result.current.setNumQubits(5))
    expect(result.current.circuit.inputs).toHaveLength(5)
    expect(result.current.circuit.inputs[1]).toEqual({ preset: '+' }) // preserved
    expect(result.current.circuit.inputs[4]).toEqual({ preset: '0' }) // new wire

    act(() => result.current.setNumQubits(1))
    expect(result.current.circuit.inputs).toHaveLength(1)
  })

  it('resets an invalid stored input on load and says so', () => {
    const { circuit, warnings } = deserialiseCircuit({
      version: 1,
      numQubits: 2,
      columns: 4,
      placements: [],
      customGates: {},
      inputs: [{ preset: 'custom', source: ['3', '4'] }, { preset: '+' }],
    })
    expect(circuit.inputs[0]).toEqual({ preset: '0' })
    expect(circuit.inputs[1]).toEqual({ preset: '+' })
    expect(warnings.join(' ')).toMatch(/q0 input was invalid/i)
  })

  it('defaults inputs for a file written before they existed', () => {
    const { circuit, warnings } = deserialiseCircuit({
      version: 1,
      numQubits: 2,
      columns: 4,
      placements: [{ id: 'a', gate: 'H', targets: [0], controls: [], params: [], column: 0 }],
      customGates: {},
    })
    expect(circuit.inputs).toEqual([{ preset: '0' }, { preset: '0' }])
    expect(warnings).toEqual([])
  })
})

describe('useCircuitStore — non-adjacent multi-qubit gates', () => {
  it('moves one end of a SWAP onto a distant wire', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('SWAP', 0, 0)
    })
    expect(result.current.circuit.placements[0].targets).toEqual([0, 1])

    act(() => {
      result.current.setTargets(id!, [0, 2])
    })
    expect(result.current.circuit.placements[0].targets).toEqual([0, 2])

    // And it actually swaps the distant wires.
    act(() => result.current.setQubitInput(0, { preset: '1' }))
    const { states } = simulate(result.current.circuit)
    expect(probabilities(states[1])[0b001]).toBeCloseTo(1, 12)
  })

  it('refuses to widen a SWAP over an occupied wire', () => {
    const { result } = renderHook(() => useCircuitStore())
    let id: string | undefined
    act(() => {
      id = result.current.addGate('SWAP', 0, 0)
    })
    act(() => result.current.setNumQubits(4))
    act(() => {
      result.current.addGate('H', 2, 0)
    })

    let ok = true
    act(() => {
      ok = result.current.setTargets(id!, [0, 3]) // would cross the H on q2
    })
    expect(ok).toBe(false)
    expect(result.current.circuit.placements[0].targets).toEqual([0, 1])
  })

  it('moves a non-adjacent SWAP rigidly, preserving the gap', () => {
    const { result } = renderHook(() => useCircuitStore())
    act(() => result.current.setNumQubits(5))
    let id: string | undefined
    act(() => {
      id = result.current.addGate('SWAP', 0, 0)
    })
    act(() => {
      result.current.setTargets(id!, [0, 2])
    })
    act(() => {
      result.current.moveGate(id!, 2, 1)
    })
    expect(result.current.circuit.placements[0].targets).toEqual([2, 4])
    expect(result.current.circuit.placements[0].column).toBe(1)
  })
})
