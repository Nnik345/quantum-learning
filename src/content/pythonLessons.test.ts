/**
 * The guide's tasks, and the fairness of their grading.
 *
 * A learner writing correct Qiskit in their own style must pass. The case that drove the
 * `distribution` mode is here as a regression: a task that asks for "50% on each outcome" cannot
 * reject |−⟩, because |−⟩ is 50% on each outcome.
 */

import { describe, it, expect } from 'vitest'

import { PYTHON_LESSONS, getPythonLesson } from './pythonLessons'
import { gradeAgainst } from './grade'
import { build, g, spread } from '../lib/quantum/builder'
import { gatesTaughtBy } from './syllabus'
import type { Circuit } from '../lib/quantum/circuit'

const task = (slug: string) => {
  const lesson = getPythonLesson(slug)
  if (!lesson) throw new Error(`no lesson "${slug}"`)
  return lesson.task
}

/** Grade a circuit exactly as the lesson page does. */
const check = (slug: string, attempt: Circuit) => {
  const t = task(slug)
  return gradeAgainst(attempt, t.solution, t.grade, t.target)
}

describe('every lesson is internally consistent', () => {
  it.each(PYTHON_LESSONS.map((l) => [l.slug, l] as const))('%s', (_slug, lesson) => {
    // Its own reference must pass its own grader, or the task is unpassable.
    expect(gradeAgainst(lesson.task.solution, lesson.task.solution, lesson.task.grade, lesson.task.target).correct).toBe(true)

    // The starter must NOT already pass, or there is nothing to do.
    expect(lesson.task.starter.length).toBeGreaterThan(0)
    expect(lesson.task.hint.length).toBeGreaterThan(0)

    // The stub tells them the variable the page looks for.
    expect(lesson.task.starter).toMatch(/circuit\s*=/)
  })

  it('has unique slugs and a sensible order', () => {
    const slugs = PYTHON_LESSONS.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs[0]).toBe('first-circuit')
    expect(slugs[slugs.length - 1]).toBe('grover')
  })

  it('only uses gates the site itself teaches', () => {
    // The guide runs alongside the 22-step path, so it may use anything taught by the end of it.
    const allowed = gatesTaughtBy(PYTHON_LESSONS.length > 0 ? 22 : 0)
    for (const lesson of PYTHON_LESSONS) {
      for (const p of lesson.task.solution.placements) {
        expect(allowed.has(p.gate), `${lesson.slug} uses ${p.gate}`).toBe(true)
      }
    }
  })
})

describe('correct work passes whatever shape it takes', () => {
  it('accepts |−⟩ for a task that asked for 50% on each outcome', () => {
    // x then h gives |−⟩. It is an even superposition, so rejecting it would be wrong — this is
    // the exact case that showed `state` grading was too strict for that prompt.
    const minus = build(1, 4, [g('X', [0], 0), g('H', [0], 1)])
    expect(check('superposition', minus).correct).toBe(true)
  })

  it('accepts the Bell pair built on the other wire', () => {
    expect(check('entanglement', build(2, 4, [g('H', [1], 0), g('X', [0], 1, [1])])).correct).toBe(true)
  })

  it('accepts a GHZ chained from one control rather than in sequence', () => {
    const fromZero = build(3, 5, [g('H', [0], 0), g('X', [1], 1, [0]), g('X', [2], 2, [0])])
    expect(check('controlled-gates', fromZero).correct).toBe(true)
  })

  it('accepts Grover with the controlled-Z written the other way round', () => {
    const mirrored = build(2, 8, [
      ...spread('H', [0, 1], 0),
      g('Z', [0], 1, [1]),
      ...spread('H', [0, 1], 2),
      ...spread('X', [0, 1], 3),
      g('Z', [0], 4, [1]),
      ...spread('X', [0, 1], 5),
      ...spread('H', [0, 1], 6),
    ])
    expect(check('grover', mirrored).correct).toBe(true)
  })

  it('ignores extra columns and a trailing measurement', () => {
    const padded = build(1, 9, [g('X', [0], 0), g('MEASURE', [0], 6)])
    expect(check('first-circuit', padded).correct).toBe(true)
  })
})

describe('wrong work is still wrong', () => {
  it('rejects a superposition where a bit flip was asked for', () => {
    expect(check('first-circuit', build(1, 4, [g('H', [0], 0)])).correct).toBe(false)
  })

  it('rejects an unentangled pair with the right marginals', () => {
    expect(check('entanglement', build(2, 3, [...spread('H', [0, 1], 0)])).correct).toBe(false)
  })

  it('rejects the doubled controlled-Z that cancels Grover’s marking', () => {
    const doubled = build(2, 9, [
      ...spread('H', [0, 1], 0),
      g('Z', [1], 1, [0]),
      g('Z', [0], 2, [1]),
      ...spread('H', [0, 1], 3),
      ...spread('X', [0, 1], 4),
      g('Z', [1], 5, [0]),
      ...spread('X', [0, 1], 6),
      ...spread('H', [0, 1], 7),
    ])
    expect(check('grover', doubled).correct).toBe(false)
  })

  it('names the register size when it is wrong', () => {
    const verdict = check('entanglement', build(3, 4, [g('H', [0], 0)]))
    expect(verdict.correct).toBe(false)
    expect(verdict.message).toMatch(/qubit/i)
  })

  it('still distinguishes the two Bell states, which the prompt names exactly', () => {
    // (|00> - |11>)/sqrt2 has the same distribution but is a different state, and the task says which.
    const phiMinus = build(2, 5, [g('H', [0], 0), g('Z', [0], 1), g('X', [1], 2, [0])])
    expect(check('entanglement', phiMinus).correct).toBe(false)
  })
})
