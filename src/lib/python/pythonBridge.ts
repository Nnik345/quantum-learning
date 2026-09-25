/**
 * A window between the Python pages and the tutor.
 *
 * Deliberately the same shape as circuitBridge: a small module singleton rather than React context,
 * because the tutor only reads when a tool fires and nothing here needs to drive a re-render.
 *
 * What it carries is everything needed to help someone who is stuck — the code they wrote, what it
 * printed, the traceback if it raised, and the task they are attempting. It never carries the
 * task's SOLUTION. The tutor should be able to help a learner reason their way out, not hand them
 * the answer, and the surest way to guarantee that is for the answer never to reach it.
 */

export interface PythonSnapshot {
  /** What is in the editor right now. */
  code: string
  /** Where they are: a lesson slug, or the playground. */
  where: 'lesson' | 'playground'
  lessonSlug?: string
  lessonTitle?: string
  /** The task prompt, which is printed on the page anyway. */
  taskPrompt?: string
  /** What success looks like in words — also already on the page. */
  taskTarget?: string
  /** Output of the last run, if they have run anything. */
  stdout?: string
  stderr?: string
  error?: string
  /** The verdict the grader gave, when they last checked. */
  verdict?: string
}

let current: PythonSnapshot | undefined
let inserter: ((code: string) => void) | undefined
let pending: string | undefined

/** Called by a Python page whenever its editor or last run changes. */
export function publishPython(snapshot: PythonSnapshot, insert: (code: string) => void): void {
  current = snapshot
  inserter = insert
}

/** Called when a Python page unmounts, so stale code is never reported as live. */
export function unpublishPython(): void {
  current = undefined
  inserter = undefined
}

export const getCurrentPython = (): PythonSnapshot | undefined => current

export const isEditorMounted = (): boolean => inserter !== undefined

/**
 * Put code into the editor. Applied immediately when a Python page is open, otherwise parked for
 * one to collect — the reader may be reading a lesson elsewhere when they ask for help.
 */
export function requestInsert(code: string): 'inserted' | 'queued' {
  if (inserter) {
    inserter(code)
    return 'inserted'
  }
  pending = code
  return 'queued'
}

/** Collected by a Python page on mount; clears the slot so a reload does not reapply it. */
export function takePendingCode(): string | undefined {
  const code = pending
  pending = undefined
  return code
}
