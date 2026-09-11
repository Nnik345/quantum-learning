/**
 * Running a circuit.
 *
 * Two modes, because measurement is genuinely ambiguous for a pure state-vector simulator:
 *
 *   simulate()  — analytic. Measurement gates are treated as no-ops and the exact pre-measurement
 *                 state is returned for every column. This is what the state / probability / Bloch
 *                 panels show, and `hasMeasurement` tells the UI to say so.
 *
 *   runShots()  — sampling. Each shot walks the circuit with a seeded RNG, collapsing and
 *                 renormalising at every measurement gate. This is the honest answer when a circuit
 *                 contains mid-circuit measurement.
 */

import {
  type Circuit,
  type Placement,
  circuitInputAmplitudes,
  gateDef,
  resolveMatrix,
  lastUsedColumn,
} from './circuit'
import { isMeasure } from './gates'
import {
  type StateVector,
  applyGate,
  basisLabel,
  cloneState,
  measureQubit,
  probabilities,
  productState,
} from './state'
import { mulberry32, randomSeed } from './rng'

export interface SimulationResult {
  /** states[0] is the initial state; states[k+1] is the state after column k. */
  states: StateVector[]
  /** Problems that stopped a placement from being applied. Surfaced in the UI, never thrown. */
  errors: string[]
  hasMeasurement: boolean
}

const columnOrder = (a: Placement, b: Placement): number => a.column - b.column

/** Run the circuit analytically, capturing the state after every column. */
export function simulate(circuit: Circuit): SimulationResult {
  const { amplitudes, errors: inputErrors } = circuitInputAmplitudes(circuit)
  const errors: string[] = [...inputErrors]
  let hasMeasurement = false

  const state = productState(amplitudes)
  const states: StateVector[] = [cloneState(state)]

  const sorted = [...circuit.placements].sort(columnOrder)
  let cursor = 0

  for (let col = 0; col < circuit.columns; col++) {
    while (cursor < sorted.length && sorted[cursor].column === col) {
      const p = sorted[cursor++]
      if (isMeasure(p.gate)) {
        hasMeasurement = true
        continue // analytic mode: no collapse
      }
      const def = gateDef(circuit, p.gate)
      if (!def) {
        errors.push(`Unknown gate "${p.gate}" at column ${col + 1}`)
        continue
      }
      const matrix = resolveMatrix(circuit, p)
      if (!matrix) {
        errors.push(`${def.name} has no matrix`)
        continue
      }
      try {
        applyGate(state, matrix, p.targets, p.controls)
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err))
      }
    }
    states.push(cloneState(state))
  }

  return { states, errors, hasMeasurement }
}

export interface ShotResult {
  /** Bitstring (over `measuredQubits`, in wire order) → number of times observed. */
  counts: Record<string, number>
  measuredQubits: number[]
  shots: number
  seed: number
  /** True when the circuit had no explicit measurement gate and every qubit was measured at the end. */
  measuredAllAtEnd: boolean
}

/** Sample one index from a probability array. */
function sampleIndex(probs: Float64Array, r: number): number {
  let acc = 0
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i]
    if (r < acc) return i
  }
  return probs.length - 1 // float drift on the last bucket
}

/**
 * Run the circuit `shots` times and histogram the outcomes.
 *
 * Fast path: with no measurement gates in the circuit, the state is deterministic, so it is
 * simulated once and sampled `shots` times from the resulting distribution rather than re-running
 * the whole circuit per shot.
 */
export function runShots(circuit: Circuit, shots: number, seed: number = randomSeed()): ShotResult {
  const rng = mulberry32(seed)
  const counts: Record<string, number> = {}
  const n = circuit.numQubits

  const measurePlacements = circuit.placements.filter((p) => isMeasure(p.gate))
  const measuredAllAtEnd = measurePlacements.length === 0

  const measuredQubits = measuredAllAtEnd
    ? Array.from({ length: n }, (_, i) => i)
    : [...new Set(measurePlacements.flatMap((p) => p.targets))].sort((a, b) => a - b)

  if (measuredAllAtEnd) {
    const { states } = simulate(circuit)
    const probs = probabilities(states[states.length - 1])
    for (let s = 0; s < shots; s++) {
      const key = basisLabel(sampleIndex(probs, rng()), n)
      counts[key] = (counts[key] ?? 0) + 1
    }
    return { counts, measuredQubits, shots, seed, measuredAllAtEnd }
  }

  const sorted = [...circuit.placements].sort(columnOrder)
  const { amplitudes } = circuitInputAmplitudes(circuit)

  for (let s = 0; s < shots; s++) {
    const state = productState(amplitudes)
    const observed = new Map<number, 0 | 1>()

    for (const p of sorted) {
      if (isMeasure(p.gate)) {
        try {
          observed.set(p.targets[0], measureQubit(state, p.targets[0], rng))
        } catch {
          observed.set(p.targets[0], 0)
        }
        continue
      }
      const matrix = resolveMatrix(circuit, p)
      if (!matrix) continue
      try {
        applyGate(state, matrix, p.targets, p.controls)
      } catch {
        // Invalid placements are reported by simulate(); skip them here.
      }
    }

    const key = measuredQubits.map((q) => observed.get(q) ?? 0).join('')
    counts[key] = (counts[key] ?? 0) + 1
  }

  return { counts, measuredQubits, shots, seed, measuredAllAtEnd }
}

/** Highest column worth stepping to — one past the last gate, clamped to the grid. */
export function stepCount(circuit: Circuit): number {
  return Math.min(circuit.columns, lastUsedColumn(circuit) + 1)
}
