/**
 * Grading, and the two promises it has to keep.
 *
 * 1. A learner who builds a CORRECT circuit is marked correct, however they arranged it. Different
 *    columns, a different decomposition, a stray measurement, a mirrored construction — all of that
 *    is right, and marking it wrong would be a bug in the grader, not in their understanding. Most
 *    of this file is that promise.
 *
 * 2. An exercise never needs something the site has not taught yet.
 */

import { describe, it, expect } from 'vitest'

import {
  EXERCISES,
  getExercise,
  predictCircuit,
  type BuildExercise,
  type PredictExercise,
} from './exercises'
import { gradeCircuit, gradeAnswer } from './grade'
import { gatesTaughtBy, maxQubitsTaughtBy, controlsTaughtBy, neverTaught } from './syllabus'
import { pathStepFor } from './path'
import { TRACKS } from './registry'
import { build, g, spread } from '../lib/quantum/builder'
import {
  equalUpToGlobalPhase,
  implementsSameOperation,
  finalState,
} from '../lib/quantum/equivalence'
import type { Circuit } from '../lib/quantum/circuit'

const buildExercise = (id: string): BuildExercise => {
  const e = getExercise(id)
  if (!e || e.kind !== 'build') throw new Error(`no build exercise "${id}"`)
  return e
}

const accepts = (id: string, attempt: Circuit) => gradeCircuit(buildExercise(id), attempt).correct

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

describe('state comparison ignores global phase but not relative phase', () => {
  it('treats a state and its negation as the same physical state', () => {
    // Z·Z is the identity up to nothing at all; Z on |+⟩ then Z again returns |+⟩.
    const plus = build(1, 2, [g('H', [0], 0)])
    const negated = build(1, 4, [g('H', [0], 0), g('Z', [0], 1), g('X', [0], 2), g('Z', [0], 3)])
    // H|0⟩ = |+⟩; Z|+⟩ = |−⟩; X|−⟩ = −|−⟩; Z(−|−⟩) = −|+⟩. Same state, opposite sign.
    expect(equalUpToGlobalPhase(finalState(plus), finalState(negated))).toBe(true)
  })

  it('catches a genuine relative phase difference', () => {
    const plus = build(1, 2, [g('H', [0], 0)])
    const minus = build(1, 3, [g('H', [0], 0), g('Z', [0], 1)])
    expect(equalUpToGlobalPhase(finalState(plus), finalState(minus))).toBe(false)
  })

  it('refuses to compare registers of different sizes', () => {
    expect(equalUpToGlobalPhase(finalState(build(1, 1, [])), finalState(build(2, 1, [])))).toBe(false)
  })
})

describe('operation comparison requires one phase across every input', () => {
  it('accepts an equivalent decomposition of the same operation', () => {
    const x = build(1, 2, [g('X', [0], 0)])
    const hzh = build(1, 4, [g('H', [0], 0), g('Z', [0], 1), g('H', [0], 2)])
    expect(implementsSameOperation(hzh, x)).toBe(true)
  })

  it('rejects a circuit that is right from |0…0⟩ but wrong as an operation', () => {
    // X and "H,Z,H,Z" both send |0⟩ to |1⟩ up to phase, but differ on |1⟩.
    const x = build(1, 2, [g('X', [0], 0)])
    const impostor = build(1, 3, [g('X', [0], 0), g('Z', [0], 1)])
    expect(equalUpToGlobalPhase(finalState(impostor), finalState(x))).toBe(true)
    expect(implementsSameOperation(impostor, x)).toBe(false)
  })

  it('rejects a per-input phase, which would be a different operation', () => {
    const identity = build(1, 2, [])
    const z = build(1, 2, [g('Z', [0], 0)])
    // Z leaves |0⟩ alone and negates |1⟩ — one input agrees, the other needs a different phase.
    expect(implementsSameOperation(z, identity)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The promise that matters: correct work is accepted however it is arranged
// ---------------------------------------------------------------------------

describe('a correct circuit passes however the learner arranged it', () => {
  it('accepts the authored solution', () => {
    expect(accepts('reach-minus', build(1, 4, [g('H', [0], 0), g('Z', [0], 1)]))).toBe(true)
  })

  it('accepts the same gates spread into different columns', () => {
    expect(accepts('reach-minus', build(1, 9, [g('H', [0], 0), g('Z', [0], 5)]))).toBe(true)
  })

  it('accepts a completely different route to the same state', () => {
    // X then H reaches |−⟩ without ever using Z.
    expect(accepts('reach-minus', build(1, 4, [g('X', [0], 0), g('H', [0], 1)]))).toBe(true)
  })

  it('accepts a trailing measurement gate', () => {
    expect(
      accepts('reach-minus', build(1, 5, [g('H', [0], 0), g('Z', [0], 1), g('MEASURE', [0], 2)])),
    ).toBe(true)
  })

  it('accepts a redundant gate and its inverse', () => {
    expect(
      accepts(
        'reach-minus',
        build(1, 6, [g('H', [0], 0), g('Z', [0], 1), g('X', [0], 2), g('X', [0], 3)]),
      ),
    ).toBe(true)
  })

  it('accepts the mirrored Bell construction, built on the other wire', () => {
    // H on q1 with the control from q1 reaches the identical state by a different OPERATION.
    // Grading this as an operation would reject correct work, which is why it is graded as a state.
    expect(accepts('build-bell-pair', build(2, 4, [g('H', [1], 0), g('X', [0], 1, [1])]))).toBe(true)
  })

  it('accepts a Grover fix with the controlled Z written the other way round', () => {
    const mirrored = build(2, 8, [
      ...spread('H', [0, 1], 0),
      g('Z', [0], 1, [1]), // control and target swapped — the same gate
      ...spread('H', [0, 1], 2),
      ...spread('X', [0, 1], 3),
      g('Z', [0], 4, [1]),
      ...spread('X', [0, 1], 5),
      ...spread('H', [0, 1], 6),
    ])
    expect(accepts('fix-grover-oracle', mirrored)).toBe(true)
  })

  it('accepts the Deutsch–Jozsa fix with the two queries in the other order', () => {
    const swapped = build(
      3,
      7,
      [
        ...spread('H', [0, 1, 2], 0),
        g('X', [2], 1, [1]),
        g('X', [2], 2, [0]),
        ...spread('H', [0, 1], 3),
      ],
      { 2: '1' },
    )
    expect(accepts('fix-dj-oracle', swapped)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// And wrong work is still wrong
// ---------------------------------------------------------------------------

describe('near misses are rejected, with a reason', () => {
  it('rejects the doubled controlled-Z that cancels the marking', () => {
    const exercise = buildExercise('fix-grover-oracle')
    const verdict = gradeCircuit(exercise, exercise.startFrom!)
    expect(verdict.correct).toBe(false)
    // The feedback reports the learner's own flat distribution rather than the answer.
    expect(verdict.message).toMatch(/25\.0%/)
    expect(verdict.message).not.toMatch(/\bZ\b.*controlled/i)
  })

  it('rejects the constant Deutsch–Jozsa oracle it ships broken', () => {
    const exercise = buildExercise('fix-dj-oracle')
    expect(gradeCircuit(exercise, exercise.startFrom!).correct).toBe(false)
  })

  it('rejects |+⟩ when |−⟩ was asked for', () => {
    expect(accepts('reach-minus', build(1, 2, [g('H', [0], 0)]))).toBe(false)
  })

  it('rejects an unentangled pair with the right marginals', () => {
    // H on both wires gives all four outcomes at 25% — not the Bell state.
    expect(accepts('build-bell-pair', build(2, 2, [...spread('H', [0, 1], 0)]))).toBe(false)
  })

  it('names the wire count when the register is the wrong size', () => {
    const verdict = gradeCircuit(buildExercise('reach-minus'), build(3, 3, [g('H', [0], 0)]))
    expect(verdict.correct).toBe(false)
    // Says how many the exercise wants and how many they have, rather than a generic mismatch.
    expect(verdict.message).toMatch(/qubit/i)
    expect(verdict.message).toMatch(/\b3\b/)
  })

  it('says so rather than failing silently on an empty board', () => {
    expect(gradeCircuit(buildExercise('reach-minus'), build(1, 4, [])).message).toMatch(/empty/i)
  })
})

// ---------------------------------------------------------------------------
// Numeric exercises
// ---------------------------------------------------------------------------

describe('numeric exercises are graded against computed truth', () => {
  it('accepts the Born-rule answer and rejects a near miss', () => {
    const e = getExercise('amplitude-to-probability')!
    expect(gradeAnswer(e, 50).correct).toBe(true)
    expect(gradeAnswer(e, 70).correct).toBe(false)
  })

  it('marginalises over the wires that are not being read', () => {
    const e = getExercise('shor-counting-register') as PredictExercise
    // Shor's four outcomes are 25% each; two of them read 100 on the counting wires.
    expect(gradeAnswer(e, 50).correct).toBe(true)
    expect(gradeAnswer(e, 25).correct).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Nothing outside the syllabus
// ---------------------------------------------------------------------------

describe('every exercise stays inside what has been taught', () => {
  const circuitsOf = (e: (typeof EXERCISES)[number]): Circuit[] =>
    e.kind === 'build'
      ? [e.solution, ...(e.startFrom ? [e.startFrom] : [])]
      : e.kind === 'predict'
        ? [predictCircuit(e)]
        : []

  it.each(EXERCISES.map((e) => [e.id, e] as const))('%s', (_id, exercise) => {
    const step = pathStepFor(exercise.slug)
    expect(step, `${exercise.slug} is not on the path`).toBeDefined()

    const allowed = gatesTaughtBy(step!.step)
    for (const circuit of circuitsOf(exercise)) {
      expect(circuit.numQubits).toBeLessThanOrEqual(maxQubitsTaughtBy(step!.step))
      for (const p of circuit.placements) {
        expect(allowed.has(p.gate), `${p.gate} is not taught by step ${step!.step}`).toBe(true)
        if (p.controls.length > 0) expect(controlsTaughtBy(step!.step)).toBe(true)
      }
    }
  })

  it('never uses a gate the site does not teach anywhere', () => {
    const forbidden = new Set(neverTaught())
    // The rotation gates and the daggered phases are named nowhere in the content, so no exercise
    // may require one. (I and Y are absent from every circuit but ARE explained in prose — the
    // eigenvector section works through both — so they stay legal.)
    expect([...forbidden].sort()).toEqual(['RX', 'RY', 'RZ', 'Sdg', 'Tdg'])
    for (const exercise of EXERCISES) {
      for (const circuit of circuitsOf(exercise)) {
        for (const p of circuit.placements) expect(forbidden.has(p.gate)).toBe(false)
      }
    }
  })

  it('has unique ids and resolves every slug to a real step', () => {
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of EXERCISES) expect(pathStepFor(e.slug)).toBeDefined()
  })

  it('ships a broken starting circuit that really is broken', () => {
    for (const e of EXERCISES) {
      if (e.kind === 'build' && e.startFrom) {
        expect(gradeCircuit(e, e.startFrom).correct, `${e.id} starts already solved`).toBe(false)
      }
    }
  })

  it('ships a solution that its own grader accepts', () => {
    for (const e of EXERCISES) {
      if (e.kind === 'build') expect(gradeCircuit(e, e.solution).correct, e.id).toBe(true)
    }
  })
})

describe('the lessons and the exercise data agree', () => {
  /** Every `exercise` block on the site, with the topic it was found on. */
  const placed = TRACKS.flatMap((track) =>
    track.topics.flatMap((topic) =>
      topic.sections.flatMap((section) =>
        (section.blocks ?? [])
          .filter((b): b is Extract<typeof b, { kind: 'exercise' }> => b.kind === 'exercise')
          .map((b) => ({ id: b.id, slug: topic.slug })),
      ),
    ),
  )

  it('renders every exercise exactly once, on the page it is pinned to', () => {
    expect(placed.map((p) => p.id).sort()).toEqual(EXERCISES.map((e) => e.id).sort())
    for (const { id, slug } of placed) {
      // An exercise printed on a different page than it declares would be graded against the wrong
      // syllabus envelope, so the two have to match.
      expect(getExercise(id)?.slug, `${id} is printed on ${slug}`).toBe(slug)
    }
  })

  it('has no block pointing at an exercise that does not exist', () => {
    for (const { id } of placed) expect(getExercise(id), id).toBeDefined()
  })
})
