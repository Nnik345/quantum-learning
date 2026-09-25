/**
 * What the reader has visited and completed, kept in localStorage.
 *
 * Two distinct ideas, deliberately: `visited` is recorded automatically when a topic is opened, so
 * the path shows signs of life immediately; `completed` requires the button, so it keeps meaning
 * something. Conflating them would make "done" mean "glanced at".
 *
 * Storage is reached through `window.localStorage` rather than the bare global — recent Node
 * versions define a conflicting one, and browsers can block site data outright. Both already bite
 * this project, so the same guarded accessor as lib/quantum/persist.ts is used here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { PATH, PATH_LENGTH, nextStep, type PathStep } from '../content/path'
import { EXERCISES } from '../content/exercises'

export const PROGRESS_KEY = 'quantum-learning:progress:v1'

interface StoredProgress {
  version: number
  visited: string[]
  completed: string[]
  /** Ids of exercises answered correctly. Absent in version 1 payloads. */
  solved?: string[]
}

/*
 * Bumped to 2 when exercises arrived. A version 1 payload still loads: the new field simply reads
 * as absent, which is an empty set, so nobody loses the progress they already had.
 */
const FORMAT_VERSION = 2

const storage = (): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined // site data blocked
  }
}

/** The three sets, as held in memory. */
interface Stored {
  visited: Set<string>
  completed: Set<string>
  solved: Set<string>
}

/** Slugs that actually exist on the path; anything else is dropped rather than trusted. */
const VALID = new Set(PATH.map((s) => s.slug))

/** Exercise ids that actually exist; a renamed exercise should not stay marked solved. */
const VALID_EXERCISES = new Set(EXERCISES.map((e) => e.id))

function readStored(): Stored {
  const empty = { visited: new Set<string>(), completed: new Set<string>(), solved: new Set<string>() }
  try {
    const raw = storage()?.getItem(PROGRESS_KEY)
    if (!raw) return empty

    const parsed = JSON.parse(raw) as Partial<StoredProgress>
    const clean = (list: unknown, known: Set<string>): Set<string> =>
      new Set(
        Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string' && known.has(s)) : [],
      )

    // Unknown slugs are silently dropped: a topic may have been renamed or removed since, and a
    // stale entry should never be able to mark a real topic done or crash the page.
    return {
      visited: clean(parsed.visited, VALID),
      completed: clean(parsed.completed, VALID),
      solved: clean(parsed.solved, VALID_EXERCISES),
    }
  } catch {
    return empty
  }
}

function writeStored(next: Stored): void {
  try {
    const payload: StoredProgress = {
      version: FORMAT_VERSION,
      visited: [...next.visited],
      completed: [...next.completed],
      solved: [...next.solved],
    }
    storage()?.setItem(PROGRESS_KEY, JSON.stringify(payload))
  } catch {
    // Private browsing or a full quota. Progress is a convenience, never a requirement — the site
    // has to keep working for someone who simply cannot store anything.
  }
}

export interface Progress {
  visited: ReadonlySet<string>
  completed: ReadonlySet<string>
  /** How many path steps are complete. */
  completedCount: number
  total: number
  /** 0–100, for the bar. */
  percent: number
  /** The first step not yet completed — what to offer next. */
  next?: PathStep
  /** Ids of exercises answered correctly. */
  solved: ReadonlySet<string>
  /** True before anything at all has happened. */
  isFresh: boolean

  markVisited: (slug: string) => void
  markComplete: (slug: string) => void
  markIncomplete: (slug: string) => void
  /** Record an exercise answered correctly. Never touches `completed`. */
  markSolved: (exerciseId: string) => void
  reset: () => void
}

export function useProgress(): Progress {
  const [state, setState] = useState<Stored>(() => ({
    visited: new Set(),
    completed: new Set(),
    solved: new Set(),
  }))

  // Read after mount rather than in the initialiser: the server-rendered/first paint should not
  // depend on storage, and this keeps the hook safe where `window` does not exist.
  useEffect(() => {
    setState(readStored())
  }, [])

  const update = useCallback((change: (current: Stored) => Stored) => {
    setState((current) => {
      const next = change(current)
      writeStored(next)
      return next
    })
  }, [])

  const markVisited = useCallback(
    (slug: string) => {
      if (!VALID.has(slug)) return
      update((current) => {
        if (current.visited.has(slug)) return current // avoid a pointless write on every render
        return { ...current, visited: new Set(current.visited).add(slug) }
      })
    },
    [update],
  )

  const markComplete = useCallback(
    (slug: string) => {
      if (!VALID.has(slug)) return
      update((current) => ({
        ...current,
        visited: new Set(current.visited).add(slug),
        completed: new Set(current.completed).add(slug),
      }))
    },
    [update],
  )

  const markIncomplete = useCallback(
    (slug: string) => {
      update((current) => {
        const completed = new Set(current.completed)
        completed.delete(slug)
        return { ...current, completed }
      })
    },
    [update],
  )

  const markSolved = useCallback(
    (exerciseId: string) => {
      if (!VALID_EXERCISES.has(exerciseId)) return
      update((current) => {
        if (current.solved.has(exerciseId)) return current
        // Solving is recorded on its own. Whether a step counts as complete stays the reader's call.
        return { ...current, solved: new Set(current.solved).add(exerciseId) }
      })
    },
    [update],
  )

  const reset = useCallback(() => {
    update(() => ({ visited: new Set(), completed: new Set(), solved: new Set() }))
  }, [update])

  return useMemo(() => {
    const completedCount = state.completed.size
    return {
      visited: state.visited,
      completed: state.completed,
      completedCount,
      total: PATH_LENGTH,
      percent: PATH_LENGTH === 0 ? 0 : Math.round((completedCount / PATH_LENGTH) * 100),
      next: nextStep(state.completed),
      solved: state.solved,
      isFresh: completedCount === 0 && state.visited.size === 0 && state.solved.size === 0,
      markVisited,
      markComplete,
      markIncomplete,
      markSolved,
      reset,
    }
  }, [state, markVisited, markComplete, markIncomplete, markSolved, reset])
}

/** Status of one step, for rendering a list. */
export type StepStatus = 'complete' | 'visited' | 'next' | 'upcoming'

export function statusOf(step: PathStep, progress: Progress): StepStatus {
  if (progress.completed.has(step.slug)) return 'complete'
  if (progress.next?.slug === step.slug) return 'next'
  if (progress.visited.has(step.slug)) return 'visited'
  return 'upcoming'
}
