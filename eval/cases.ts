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
  /** Tools the model must have called. Use only where consulting one is the point of the case. */
  requireTools?: string[]
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
  /** Tools the model must have called. Use only where consulting one is the point of the case. */
  requireTools?: string[]
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
    check: (r) => {
      const entangled = (r.outcome?.entangled ?? []).length === 3
      return {
        pass: near(p(r, '000'), 50) && near(p(r, '111'), 50) && entangled,
        detail: `|000⟩ ${p(r, '000').toFixed(1)}%, |111⟩ ${p(r, '111').toFixed(1)}%, ${
          entangled ? 'all three entangled' : 'NOT fully entangled'
        }`,
      }
    },
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
    intent: 'A known algorithm with an exact answer — and an actual search, not a lookalike',
    prompt: 'Build a 2-qubit Grover search that finds the marked state |11>, with one iteration.',
    /*
     * Landing on |11⟩ is necessary but nowhere near sufficient.
     *
     * A circuit of H,H | X,X | Z,Z | X,X | H,H reaches |11⟩ with certainty and contains no
     * controlled gate at all — so nothing marks anything and no search happens. The original check
     * passed exactly that circuit, which meant "grover passed" never established that Grover was
     * built. Searching requires something that couples the wires, so the structure is checked too.
     */
    check: (r) => {
      const gates = r.circuit?.placements ?? []
      const controlled = gates.filter((g) => g.controls.length > 0)
      const hadamards = gates.filter((g) => g.gate === 'H')
      const found = p(r, '11')

      const problems = [
        found > 95 ? '' : `|11⟩ only ${found.toFixed(1)}%`,
        controlled.length > 0 ? '' : 'no controlled gate — nothing marks the answer, so it is not a search',
        hadamards.length >= 2 ? '' : 'no superposition to search over',
      ].filter(Boolean)

      return {
        pass: problems.length === 0,
        detail:
          problems.length === 0
            ? `|11⟩ ${found.toFixed(1)}% via ${controlled.length} controlled gate(s) — a real search`
            : problems.join('; '),
      }
    },
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
  {
    kind: 'text',
    id: 'citation',
    intent: 'Cites the page an answer came from, as a link the reader can follow',
    prompt: 'What is the Bernstein–Vazirani algorithm, and where can I read about it on this site?',
    /*
     * The markdown form is the test, not the bare path: an answer that merely mentions a URL is not
     * a citation the reader can click. Only internal paths survive rendering, so an external link
     * here would be silently dropped — hence the rejection rather than mere absence of credit.
     */
    expect: [/\]\(\/algorithms\/bernstein-vazirani\)/, /one query|single query|one call|one shot/i],
    reject: [/https?:\/\//],
  },
  {
    kind: 'circuit',
    id: 'reference-backed',
    intent: 'Consults the verified circuit instead of building a named algorithm from memory',
    /*
     * The site's Bernstein–Vazirani hides s = 1011. That choice is arbitrary and local, so a model
     * working from memory cannot land on it — which makes the hidden string itself the evidence that
     * the reference was read rather than recalled.
     */
    prompt: 'Build the Bernstein–Vazirani circuit exactly as it appears on this site.',
    requireTools: ['get_reference_circuit'],
    check: (r) => {
      const likely = (r.outcome?.probabilities ?? []).filter((x) => x.percent > 1)
      const wrong = likely.filter((x) => !x.label.startsWith('1011'))
      return {
        pass: likely.length > 0 && wrong.length === 0,
        detail: likely.length
          ? wrong.length
            ? `read s = ${likely[0].label.slice(0, 4)}, not the site's 1011`
            : `recovered s = 1011 (${likely.map((x) => x.label).join(', ')})`
          : 'no outcome to read',
      }
    },
  },
]
