/**
 * Reconciling Qiskit's qubit ordering with this site's.
 *
 * Qiskit is little-endian: qubit `i` carries place value 2^i, and a printed bitstring runs
 * q(n-1) … q1 q0, so **q0 is the RIGHTMOST character**. This site is the reverse — q0 is the top
 * wire and the LEFTMOST symbol in a ket — which is the textbook convention every lesson page states.
 *
 * Mapping `siteWire = n - 1 - qiskitQubit` does not paper over that disagreement; it resolves it.
 * After the flip, both systems print the SAME bitstring for the same physical state:
 *
 *   Qiskit: qc.x(0) on 3 qubits          -> prints "001" (qubit 0 is rightmost)
 *   Here:   X on wire 2 of 3             -> prints "001" (wire 0 is leftmost)
 *
 * So a learner can compare Qiskit's own output with the site's panels directly, and they agree.
 * That is the whole reason the conversion is worth doing rather than just warning about the
 * difference. It lives in one function so there is exactly one place it can be wrong.
 */

import { MAX_QUBITS } from '../quantum/state'

/** One gate as the Python service reports it, in Qiskit's indices. */
export interface QiskitGate {
  gate: string
  targets: number[]
  controls?: number[]
  angle?: number
  column: number
}

export interface QiskitCircuit {
  numQubits: number
  gates: QiskitGate[]
  /** Instructions the service could not map to a gate on this platform. */
  unsupported?: string[]
}

/** A wire index in this site's ordering. Its own inverse, since it is a reflection. */
export const flipWire = (numQubits: number, wire: number): number => numQubits - 1 - wire

export interface ConversionResult {
  /** Shaped for `validateProposal` in lib/llm/validate.ts. */
  proposal?: { numQubits: number; gates: QiskitGate[] }
  errors: string[]
}

/**
 * Convert a circuit from Qiskit's indices to this site's.
 *
 * Index order WITHIN a gate is preserved, which matters: the validator reads a `CX` as
 * [control, target], exactly the order Qiskit's `qc.cx(control, target)` produces. Flipping each
 * index independently keeps that pairing intact, so controls cannot silently swap with targets.
 */
export function fromQiskitOrder(circuit: QiskitCircuit): ConversionResult {
  const errors: string[] = []
  const n = circuit.numQubits

  if (!Number.isInteger(n) || n < 1) {
    return { errors: [`A circuit needs at least one qubit; got ${n}.`] }
  }
  if (n > MAX_QUBITS) {
    return {
      errors: [
        `That circuit uses ${n} qubits. This simulator handles at most ${MAX_QUBITS}, so it cannot be shown on the board.`,
      ],
    }
  }

  const flip = (wire: number, gate: string): number | undefined => {
    if (!Number.isInteger(wire) || wire < 0 || wire >= n) {
      // Out of range would silently wrap into a different wire, so it is refused instead.
      errors.push(`${gate}: qubit ${wire} is outside the circuit's ${n} wires.`)
      return undefined
    }
    return flipWire(n, wire)
  }

  const gates: QiskitGate[] = []
  for (const gate of circuit.gates ?? []) {
    const targets = (gate.targets ?? []).map((w) => flip(w, gate.gate))
    const controls = (gate.controls ?? []).map((w) => flip(w, gate.gate))
    if ([...targets, ...controls].some((w) => w === undefined)) continue

    gates.push({
      ...gate,
      targets: targets as number[],
      controls: controls as number[],
    })
  }

  return { proposal: { numQubits: n, gates }, errors }
}
