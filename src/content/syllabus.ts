/**
 * What has been taught by a given step of the path.
 *
 * Exercises must never require something the learner has not met yet, and the only way to keep that
 * true as content moves around is to derive it from the content itself. Nothing here is a hand-kept
 * list: move a circuit to a later page and the envelope narrows automatically.
 *
 * Two sources count as "taught":
 *
 *   - a gate placed in a circuit printed on a page at or before this step
 *   - a gate named in that page's prose
 *
 * Widgets deliberately do NOT count. The matrix playground on the Vectors page renders buttons for
 * S, T and the rotation gates long before any of them is explained, and treating a control the
 * learner can click as an idea they have been taught would let exercises run well ahead of the
 * writing.
 *
 * The result is a floor, not a licence, and it errs towards permissive in two known ways:
 *
 *   - A two-qubit controlled circuit is printed on the Bloch sphere page six steps before
 *     entanglement is defined, so this will happily permit an entanglement exercise there.
 *   - Single-letter gate ids collide with ordinary mathematics. The eigenvalues page writes P for a
 *     projector and I for the identity matrix, which this reads as the P and I gates. So a gate can
 *     look "taught" a few steps early.
 *
 * Both are acceptable for what this is: a guard against an exercise needing something the site has
 * never shown at all. The qubit ceiling and the circuit-derived gates are exact, and those are what
 * actually stop an exercise running ahead. Authoring still has to respect the conceptual order.
 */

import { PATH } from './path'
import { getTopic } from './registry'
import type { Block } from './types'
import { BUILTIN_GATES } from '../lib/quantum/gates'
import { getPreset } from '../lib/quantum/presets'

export interface Envelope {
  /** Gate ids legal to use in an exercise at this step. */
  gates: Set<string>
  /** Largest circuit the learner has been shown. 0 before any circuit appears. */
  maxQubits: number
  /** Whether any circuit shown so far uses a control. */
  controls: boolean
}

const GATE_IDS = BUILTIN_GATES.map((g) => g.id)

/** Prose carried by a block, for scanning. Widgets and circuits contribute no text. */
function textOf(block: Block): string {
  switch (block.kind) {
    case 'text':
      return block.text
    case 'callout':
      return `${block.title ?? ''} ${block.text}`
    case 'math':
      return `${block.tex} ${block.caption ?? ''}`
    case 'list':
      return block.items.join(' ')
    default:
      return ''
  }
}

/**
 * Gate ids named in a piece of prose.
 *
 * Word-boundary matched on the id, so "T" in "the T gate" counts while the T in "Two" does not.
 * Case-sensitive on purpose: gate ids are upper case, and lower-casing would make every "x" in the
 * maths a mention of the X gate.
 */
function gatesNamedIn(text: string): string[] {
  return GATE_IDS.filter((id) => new RegExp(`(^|[^A-Za-z])${id}([^A-Za-z]|$)`).test(text))
}

/** Built once: the cumulative envelope after each step, indexed by step number. */
const BY_STEP: Envelope[] = (() => {
  const out: Envelope[] = []
  const gates = new Set<string>()
  let maxQubits = 0
  let controls = false

  for (const step of PATH) {
    const topic = getTopic(step.trackId, step.slug)
    for (const section of topic?.sections ?? []) {
      for (const block of section.blocks ?? []) {
        for (const id of gatesNamedIn(textOf(block))) gates.add(id)

        if (block.kind !== 'circuit') continue
        const preset = getPreset(block.preset)
        if (!preset) continue

        maxQubits = Math.max(maxQubits, preset.circuit.numQubits)
        for (const placement of preset.circuit.placements) {
          gates.add(placement.gate)
          if (placement.controls.length > 0) controls = true
        }
      }
    }
    out[step.step] = { gates: new Set(gates), maxQubits, controls }
  }

  return out
})()

/** The envelope after a given step. Steps beyond the path clamp to the end. */
export function envelopeAt(step: number): Envelope {
  if (step < 1) return { gates: new Set(), maxQubits: 0, controls: false }
  return BY_STEP[Math.min(step, PATH.length)]
}

export const gatesTaughtBy = (step: number): Set<string> => envelopeAt(step).gates
export const maxQubitsTaughtBy = (step: number): number => envelopeAt(step).maxQubits
export const controlsTaughtBy = (step: number): boolean => envelopeAt(step).controls

/** Gate ids the site never teaches anywhere. Nothing may use these. */
export function neverTaught(): string[] {
  const all = gatesTaughtBy(PATH.length)
  return GATE_IDS.filter((id) => !all.has(id))
}
