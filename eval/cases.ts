/**
 * The eval set.
 *
 * Circuit cases are scored by RUNNING the circuit the model built and checking the physics — not by
 * reading its prose. That makes them real tests. Text cases are keyword-scored, which is crude, and
 * the harness says so rather than implying the answers were checked for correctness.
 */

import type { ValidationResult } from '../src/lib/llm/validate'

export interface CircuitCase {
  kind: 'circuit'
  id: string
  /** What is actually being tested, printed alongside the result. */
  intent: string
  prompt: string
  /** Given the validated circuit the model produced, did it do the right thing? */
  check: (result: ValidationResult) => { pass: boolean; detail: string }
}

export interface TextCase {
  kind: 'text'
  id: string
  intent: string
  prompt: string
  /** Every group must have at least one of its alternatives present. */
  expect: RegExp[]
  /** None of these may appear. */
  reject?: RegExp[]
}

export type EvalCase = CircuitCase | TextCase

/** Probability of a given basis label, or 0. */
const p = (r: ValidationResult, label: string): number =>
  r.outcome?.probabilities.find((x) => x.label === label)?.percent ?? 0

const near = (value: number, target: number, tolerance = 2) => Math.abs(value - target) <= tolerance

export const EVAL_CASES: EvalCase[] = [
  {
    kind: 'circuit',
    id: 'bell',
    intent: 'Builds the canonical entangled pair',
    prompt: 'Build a Bell state.',
    check: (r) => {
      const ok00 = near(p(r, '00'), 50)
      const ok11 = near(p(r, '11'), 50)
      const entangled = (r.outcome?.entangled ?? []).length === 2
      return {
        pass: ok00 && ok11 && entangled,
        detail: `|00⟩ ${p(r, '00').toFixed(1)}%, |11⟩ ${p(r, '11').toFixed(1)}%, entangled ${r.outcome?.entangled.join()}`,
      }
    },
  },
  {
    kind: 'circuit',
    id: 'ghz',
    intent: 'Extends entanglement to three qubits',
    prompt: 'Make a 3-qubit GHZ state.',
    check: (r) => ({
      pass: near(p(r, '000'), 50) && near(p(r, '111'), 50),
      detail: `|000⟩ ${p(r, '000').toFixed(1)}%, |111⟩ ${p(r, '111').toFixed(1)}%`,
    }),
  },
  {
    kind: 'circuit',
    id: 'bit-order',
    intent: 'THE Qiskit trap: q0 must be the leftmost bit',
    prompt: 'Build a 3-qubit circuit where q0 ends in |1> and q1 and q2 end in |0>. Use an X gate.',
    check: (r) => {
      const label = r.outcome?.probabilities[0]?.label ?? '?'
      return {
        pass: label === '100',
        detail: `got |${label}⟩ — ${label === '001' ? 'MIRRORED (Qiskit ordering)' : label === '100' ? 'correct' : 'unexpected'}`,
      }
    },
  },
  {
    kind: 'circuit',
    id: 'grover',
    intent: 'A known algorithm with an exact answer',
    prompt: 'Build a 2-qubit Grover search that finds the marked state |11>, with one iteration.',
    check: (r) => ({
      pass: p(r, '11') > 95,
      detail: `|11⟩ ${p(r, '11').toFixed(1)}% (expected ~100%)`,
    }),
  },
  {
    kind: 'circuit',
    id: 'superposition',
    intent: 'Simplest possible request',
    prompt: 'Put a single qubit into an equal superposition.',
    check: (r) => ({
      pass: near(p(r, '0'), 50) && near(p(r, '1'), 50),
      detail: `|0⟩ ${p(r, '0').toFixed(1)}%, |1⟩ ${p(r, '1').toFixed(1)}%`,
    }),
  },
  {
    kind: 'circuit',
    id: 'input-state',
    intent: 'Uses the per-wire input feature rather than an X gate',
    prompt: 'Make a 2-qubit circuit where q0 starts in the |+> state and nothing else happens.',
    check: (r) => ({
      pass: near(p(r, '00'), 50) && near(p(r, '10'), 50),
      detail: `|00⟩ ${p(r, '00').toFixed(1)}%, |10⟩ ${p(r, '10').toFixed(1)}%`,
    }),
  },
  {
    kind: 'circuit',
    id: 'controlled-z',
    intent: 'Knows a CZ is Z with a control, not a separate gate',
    prompt: 'Apply a controlled-Z between q0 and q1, with both qubits first put into superposition.',
    check: (r) => {
      const gates = r.circuit?.placements ?? []
      const hasCz = gates.some((g) => g.gate === 'Z' && g.controls.length === 1)
      return { pass: hasCz, detail: hasCz ? 'used Z with a control' : `gates: ${gates.map((g) => g.gate).join()}` }
    },
  },
  {
    kind: 'text',
    id: 'limit',
    intent: 'Knows the platform ceiling it was told about',
    prompt: 'How many qubits can I use in this simulator?',
    expect: [/\b8\b|eight/i],
  },
  {
    kind: 'text',
    id: 'ordering-question',
    intent: 'States this site’s convention, not Qiskit’s',
    prompt: 'On this site, is q0 the leftmost or the rightmost bit in a ket?',
    /*
     * Require q0 to be tied to "leftmost", rather than banning the word "rightmost" outright.
     * A good answer mentions rightmost on purpose — to contrast with Qiskit, which is exactly what
     * the site's own page does. Banning the word failed a correct, well-sourced answer, which is
     * the keyword scoring's weakness in miniature.
     */
    expect: [/q0[^.]{0,60}(leftmost|left)/i],
  },
  {
    kind: 'text',
    id: 'diffuser',
    intent: 'Retrieves and uses the site’s own explanation',
    prompt: 'What does the diffuser do in Grover’s algorithm?',
    expect: [/reflect|inversion|amplitude amplification/i, /mean|average/i],
  },
  {
    kind: 'text',
    id: 'unitary',
    intent: 'Core theory, grounded in the site',
    prompt: 'Why do quantum gates have to be unitary?',
    expect: [/probabilit|normalis|normaliz/i, /reversib|invert/i],
  },
  {
    kind: 'text',
    id: 'feedforward',
    intent: 'Knows a simulator limitation it could not guess',
    prompt: 'Can I use a measurement result to control a later gate in this simulator?',
    expect: [/no|cannot|can't|not possible/i],
  },
]
