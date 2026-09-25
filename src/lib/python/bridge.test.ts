/**
 * What the tutor can and cannot see of the learner's Python.
 *
 * The load-bearing assertion is the negative one: the task's solution must never reach the model.
 * A tutor that can read the answer will hand it over, and the lesson stops being a lesson.
 */

import { describe, it, expect, afterEach } from 'vitest'

import {
  publishPython,
  unpublishPython,
  getCurrentPython,
  requestInsert,
  takePendingCode,
  isEditorMounted,
} from './pythonBridge'
import { dispatchTool } from '../llm/tools'
import { getPythonLesson } from '../../content/pythonLessons'

afterEach(() => {
  unpublishPython()
  takePendingCode()
})

const noop = () => {}

describe('the bridge', () => {
  it('reports nothing when no Python page is open', () => {
    expect(getCurrentPython()).toBeUndefined()
    expect(isEditorMounted()).toBe(false)
  })

  it('hands a published snapshot back, and forgets it on unmount', () => {
    publishPython({ code: 'print(1)', where: 'playground' }, noop)
    expect(getCurrentPython()?.code).toBe('print(1)')
    unpublishPython()
    expect(getCurrentPython()).toBeUndefined()
  })

  it('parks a suggestion when no editor is open, and delivers it once', () => {
    expect(requestInsert('print("later")')).toBe('queued')
    expect(takePendingCode()).toBe('print("later")')
    expect(takePendingCode()).toBeUndefined()
  })

  it('applies a suggestion straight away when an editor is open', () => {
    let received: string | undefined
    publishPython({ code: '', where: 'playground' }, (code) => (received = code))
    expect(requestInsert('print("now")')).toBe('inserted')
    expect(received).toBe('print("now")')
  })
})

describe('get_python_code', () => {
  it('says where to go when the user is not on a Python page', async () => {
    const r = await dispatchTool('get_python_code', {})
    expect(r.content).toMatch(/not on a Python page/i)
    expect(r.content).toMatch(/\/python/)
  })

  it('reports the code, the traceback and the task', async () => {
    publishPython(
      {
        code: 'circuit.h(0)',
        where: 'lesson',
        lessonSlug: 'entanglement',
        lessonTitle: 'Two qubits, and entanglement',
        taskPrompt: 'Build the Bell state.',
        taskTarget: '50% on |00> and 50% on |11>',
        error: 'NameError: name “circuit” is not defined',
        verdict: 'Not yet. Yours gives |0⟩ 100%.',
      },
      noop,
    )
    const r = await dispatchTool('get_python_code', {})

    expect(r.content).toMatch(/Two qubits, and entanglement/)
    expect(r.content).toMatch(/Build the Bell state/)
    expect(r.content).toMatch(/circuit\.h\(0\)/)
    expect(r.content).toMatch(/NameError/)
    expect(r.content).toMatch(/Not yet/)
  })

  it('never carries the lesson’s solution', async () => {
    const lesson = getPythonLesson('entanglement')!
    publishPython(
      {
        code: '# nothing yet',
        where: 'lesson',
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        taskPrompt: lesson.task.prompt,
        taskTarget: lesson.task.target,
      },
      noop,
    )
    const r = await dispatchTool('get_python_code', {})

    // The gates of the answer appear nowhere in what the model receives...
    for (const placement of lesson.task.solution.placements) {
      expect(r.content).not.toMatch(new RegExp(`"gate"\\\\s*:\\\\s*"${placement.gate}"`))
    }
    // ...and it is told plainly that it does not have them.
    expect(r.content).toMatch(/do NOT have the task's solution/i)
  })

  it('says when they have not run anything yet', async () => {
    publishPython({ code: 'x = 1', where: 'playground' }, noop)
    expect((await dispatchTool('get_python_code', {})).content).toMatch(/not run it yet/i)
  })
})

describe('suggest_python', () => {
  it('passes code to the UI rather than applying it', async () => {
    const r = await dispatchTool('suggest_python', {
      code: 'circuit.h(0)\ncircuit.cx(0, 1)',
      explanation: 'The control was missing.',
    })
    expect(r.python?.code).toMatch(/cx\(0, 1\)/)
    expect(r.python?.explanation).toBe('The control was missing.')
    // Nothing is inserted until the user clicks.
    expect(takePendingCode()).toBeUndefined()
  })

  it('refuses an empty suggestion', async () => {
    expect((await dispatchTool('suggest_python', { code: '   ' })).content).toMatch(/no code/i)
  })

  it('tells the model to explain itself rather than let the code speak', async () => {
    const r = await dispatchTool('suggest_python', { code: 'print(1)' })
    expect(r.content).toMatch(/explain/i)
  })
})
