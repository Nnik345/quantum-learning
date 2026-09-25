/**
 * The guided learning path: one ordered route through every topic on the site.
 *
 * The tracks say what kind of thing a topic is; this says when to read it. Maths and theory are
 * interleaved with the algorithms that consume them, so the first algorithm arrives at step 8
 * rather than after a long unrewarded run-up.
 *
 * This is the single source of truth for ordering. Step numbers, progress totals, prev/next links
 * and the whole front page derive from it — reordering is moving a line. Topics are referenced by
 * slug rather than copied, so content lives in exactly one place, and a test asserts every topic in
 * TRACKS appears here exactly once (add a topic without placing it and the build fails rather than
 * the reader silently never seeing it).
 */

import { getTopic, TRACKS } from './registry'
import type { Topic } from './types'

export interface PathRef {
  trackId: string
  slug: string
}

export interface Stage {
  id: string
  title: string
  /** One line on what this stage gets you, shown above its steps. */
  blurb: string
  topics: PathRef[]
}

const math = (slug: string): PathRef => ({ trackId: 'math', slug })
const theory = (slug: string): PathRef => ({ trackId: 'theory', slug })
const algorithm = (slug: string): PathRef => ({ trackId: 'algorithms', slug })

export const STAGES: Stage[] = [
  {
    id: 'foundations',
    title: 'Foundations',
    blurb: 'The mathematics quantum amplitudes actually live in.',
    topics: [
      math('complex-numbers'),
      math('vectors-and-matrices'),
      math('eigenvalues-and-eigenvectors'),
    ],
  },
  {
    id: 'one-qubit',
    title: 'One Qubit',
    blurb:
      'Everything a single qubit can be and do — ending with a real algorithm you can run in eight steps.',
    topics: [
      theory('dirac-notation'),
      theory('qubits-and-the-bloch-sphere'),
      theory('quantum-gates'),
      math('probability'),
      theory('measurement'),
      algorithm('quantum-random-numbers'),
    ],
  },
  {
    id: 'many-qubits',
    title: 'Many Qubits',
    blurb: 'How qubits combine, what entanglement is, and the three protocols it buys you.',
    topics: [
      theory('tensor-products'),
      theory('entanglement'),
      algorithm('bell-states'),
      algorithm('superdense-coding'),
      algorithm('quantum-teleportation'),
    ],
  },
  {
    id: 'oracles',
    title: 'Oracles & Query Complexity',
    blurb:
      'Four algorithms that each ask a black box fewer questions than any classical method can.',
    topics: [
      algorithm('deutsch'),
      algorithm('deutsch-jozsa'),
      algorithm('bernstein-vazirani'),
      algorithm('simons-algorithm'),
    ],
  },
  {
    id: 'amplitude-and-phase',
    title: 'Amplitude & Phase',
    blurb:
      'The machinery behind every exponential speedup — amplitude amplification and the Fourier transform.',
    topics: [
      algorithm('grovers-search'),
      algorithm('quantum-fourier-transform'),
      algorithm('phase-estimation'),
    ],
  },
  {
    id: 'synthesis',
    title: 'Synthesis',
    blurb: 'Everything so far, combined into the result that made the world pay attention.',
    topics: [algorithm('shors-algorithm')],
  },
]

export interface PathStep {
  /** 1-based position along the whole path. */
  step: number
  trackId: string
  slug: string
  topic: Topic
  stage: Stage
  /** Position within the stage, 1-based. */
  stepInStage: number
}

/** Every step in order. Built once; the path is static. */
export const PATH: PathStep[] = (() => {
  const steps: PathStep[] = []
  for (const stage of STAGES) {
    stage.topics.forEach((ref, i) => {
      const topic = getTopic(ref.trackId, ref.slug)
      // A bad reference is a build-time mistake, caught by path.test.ts. Skipping keeps the site
      // usable rather than blank if one ever slips through.
      if (!topic) return
      steps.push({
        step: steps.length + 1,
        trackId: ref.trackId,
        slug: ref.slug,
        topic,
        stage,
        stepInStage: i + 1,
      })
    })
  }
  return steps
})()

export const PATH_LENGTH = PATH.length

const BY_SLUG = new Map(PATH.map((s) => [s.slug, s]))

/** Where a topic sits on the path, if it is on it. */
export const pathStepFor = (slug: string): PathStep | undefined => BY_SLUG.get(slug)

/** Steps either side, crossing tracks — Measurement is followed by Quantum Random Numbers. */
export function pathNeighbours(slug: string): { previous?: PathStep; next?: PathStep } {
  const current = BY_SLUG.get(slug)
  if (!current) return {}
  return { previous: PATH[current.step - 2], next: PATH[current.step] }
}

/**
 * What a topic assumes you have read: simply everything before it.
 *
 * Derived rather than declared on purpose. A hand-written dependency graph would be more precise,
 * but it is a second ordering that can drift out of step with this one — and there is no way to
 * notice when it does.
 */
export function prerequisitesOf(slug: string): PathStep[] {
  const current = BY_SLUG.get(slug)
  if (!current) return []
  return PATH.slice(0, current.step - 1)
}

/** The first step not yet completed — what the front page offers next. */
export function nextStep(completed: ReadonlySet<string>): PathStep | undefined {
  return PATH.find((s) => !completed.has(s.slug))
}

/** Every topic known to the site, for the integrity check and for reference pages. */
export const allTopicRefs = (): PathRef[] =>
  TRACKS.flatMap((track) => track.topics.map((t) => ({ trackId: track.id, slug: t.slug })))
