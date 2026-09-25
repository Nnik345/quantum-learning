/**
 * The path is the site's only ordering, so these tests guard it structurally: nothing may be
 * unreachable, duplicated, or placed before something it depends on.
 */

import { describe, it, expect } from 'vitest'

import {
  PATH,
  PATH_LENGTH,
  STAGES,
  allTopicRefs,
  nextStep,
  pathNeighbours,
  pathStepFor,
  prerequisitesOf,
} from './path'
import { TRACKS, getTopic } from './registry'

const positionOf = (slug: string): number => {
  const step = pathStepFor(slug)
  if (!step) throw new Error(`"${slug}" is not on the path`)
  return step.step
}

describe('every topic is reachable, exactly once', () => {
  it('places every topic that exists', () => {
    const onPath = new Set(PATH.map((s) => s.slug))
    const missing = allTopicRefs()
      .filter((ref) => !onPath.has(ref.slug))
      .map((ref) => `${ref.trackId}/${ref.slug}`)

    // A topic added to a track but never placed would be invisible to a reader following the path.
    expect(missing).toEqual([])
  })

  it('places none of them twice', () => {
    const slugs = PATH.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('references only topics that resolve', () => {
    const broken = STAGES.flatMap((stage) =>
      stage.topics
        .filter((ref) => !getTopic(ref.trackId, ref.slug))
        .map((ref) => `${stage.id}: ${ref.trackId}/${ref.slug}`),
    )
    expect(broken).toEqual([])
  })

  it('covers all 22 topics across three tracks', () => {
    const total = TRACKS.reduce((n, t) => n + t.topics.length, 0)
    expect(PATH_LENGTH).toBe(total)
    expect(PATH_LENGTH).toBe(22)
  })
})

describe('step numbering', () => {
  it('runs contiguously from 1', () => {
    expect(PATH.map((s) => s.step)).toEqual(Array.from({ length: PATH_LENGTH }, (_, i) => i + 1))
  })

  it('numbers within each stage from 1', () => {
    for (const stage of STAGES) {
      const steps = PATH.filter((s) => s.stage.id === stage.id)
      expect(steps.map((s) => s.stepInStage)).toEqual(steps.map((_, i) => i + 1))
    }
  })

  it('has six non-empty stages with unique ids', () => {
    expect(STAGES).toHaveLength(6)
    for (const stage of STAGES) expect(stage.topics.length).toBeGreaterThan(0)
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(6)
  })
})

describe('the order respects what depends on what', () => {
  const before = (earlier: string, later: string) => {
    expect(`${earlier} < ${later}: ${positionOf(earlier) < positionOf(later)}`).toBe(
      `${earlier} < ${later}: true`,
    )
  }

  it('teaches the maths before the theory that uses it', () => {
    before('complex-numbers', 'dirac-notation')
    before('vectors-and-matrices', 'dirac-notation')
    before('vectors-and-matrices', 'quantum-gates')
    before('probability', 'measurement')
  })

  it('teaches the theory before the algorithms that use it', () => {
    before('quantum-gates', 'quantum-random-numbers')
    before('measurement', 'quantum-random-numbers')
    before('tensor-products', 'entanglement')
    before('entanglement', 'bell-states')
    before('eigenvalues-and-eigenvectors', 'phase-estimation')
    // Now that it sits in Foundations it also precedes Measurement, whose observables section
    // leans on it.
    before('eigenvalues-and-eigenvectors', 'measurement')
  })

  it('builds each algorithm only on earlier ones', () => {
    before('bell-states', 'superdense-coding')
    before('bell-states', 'quantum-teleportation')
    before('deutsch', 'deutsch-jozsa')
    before('deutsch-jozsa', 'bernstein-vazirani')
    before('simons-algorithm', 'shors-algorithm')
    before('quantum-fourier-transform', 'phase-estimation')
    before('phase-estimation', 'shors-algorithm')
  })

  it('reaches a real algorithm early rather than front-loading the maths', () => {
    // The point of interleaving: a payoff well before the halfway mark, not after all the theory.
    expect(positionOf('quantum-random-numbers')).toBeLessThanOrEqual(9)
  })

  it('groups the linear algebra together in Foundations', () => {
    const foundations = PATH.filter((s) => s.stage.id === 'foundations').map((s) => s.slug)
    expect(foundations).toEqual([
      'complex-numbers',
      'vectors-and-matrices',
      'eigenvalues-and-eigenvectors',
    ])
  })

  it('ends on Shor', () => {
    expect(PATH[PATH_LENGTH - 1].slug).toBe('shors-algorithm')
  })

  it('starts on complex numbers', () => {
    expect(PATH[0].slug).toBe('complex-numbers')
  })
})

describe('pathNeighbours', () => {
  it('crosses tracks without leaving the path', () => {
    const { next } = pathNeighbours('measurement')
    expect(next?.slug).toBe('quantum-random-numbers')
    // Theory to algorithms — a link the per-track neighbours could never produce.
    expect(next?.trackId).toBe('algorithms')

    const { previous } = pathNeighbours('quantum-random-numbers')
    expect(previous?.slug).toBe('measurement')
    expect(previous?.trackId).toBe('theory')
  })

  it('has no previous at the start and no next at the end', () => {
    expect(pathNeighbours(PATH[0].slug).previous).toBeUndefined()
    expect(pathNeighbours(PATH[0].slug).next?.slug).toBe(PATH[1].slug)
    expect(pathNeighbours(PATH[PATH_LENGTH - 1].slug).next).toBeUndefined()
  })

  it('returns nothing for a topic that is not on the path', () => {
    expect(pathNeighbours('not-a-topic')).toEqual({})
  })

  it('chains all the way through', () => {
    // Walking next from the first step must visit every step in order.
    const walked: string[] = [PATH[0].slug]
    let cursor = pathNeighbours(PATH[0].slug).next
    while (cursor) {
      walked.push(cursor.slug)
      cursor = pathNeighbours(cursor.slug).next
    }
    expect(walked).toEqual(PATH.map((s) => s.slug))
  })
})

describe('prerequisites', () => {
  it('are everything before a topic', () => {
    expect(prerequisitesOf('complex-numbers')).toEqual([])
    expect(prerequisitesOf('dirac-notation').map((s) => s.slug)).toEqual([
      'complex-numbers',
      'vectors-and-matrices',
      'eigenvalues-and-eigenvectors',
    ])
    expect(prerequisitesOf('shors-algorithm')).toHaveLength(21)
  })

  it('are empty for an unknown topic rather than throwing', () => {
    expect(prerequisitesOf('nonsense')).toEqual([])
  })
})

describe('nextStep', () => {
  it('offers the first step to a new reader', () => {
    expect(nextStep(new Set())?.slug).toBe('complex-numbers')
  })

  it('offers the first gap, not merely the step after the last completed one', () => {
    // Someone who skipped ahead should still be sent back to what they missed.
    const skipped = new Set(['complex-numbers', 'grovers-search'])
    expect(nextStep(skipped)?.slug).toBe('vectors-and-matrices')
  })

  it('returns nothing once everything is done', () => {
    expect(nextStep(new Set(PATH.map((s) => s.slug)))).toBeUndefined()
  })
})
