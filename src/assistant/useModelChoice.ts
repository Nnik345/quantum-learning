import { useCallback, useEffect, useMemo, useState } from 'react'

import { DEFAULT_MODEL, OllamaClient, type AvailableModel } from '../lib/llm/client'

/**
 * Which model the tutor is talking to, and what else is on offer.
 *
 * The list comes from the daemon rather than from a constant here, so the picker adapts to the
 * machine it is running on: a 8 GB laptop that pulled a 2B and a 24 GB workstation that pulled a
 * 27B each see exactly what they have, and nothing that would fail to load.
 *
 * The choice is per-reader and remembered, like the other preferences in this project. It is
 * deliberately not an environment variable: OLLAMA_MODEL still sets the DEFAULT, but a reader who
 * wants a more careful answer for one hard question should not have to restart anything.
 */

export const MODEL_KEY = 'quantum-learning:model:v1'

const storage = (): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined // site data blocked
  }
}

/** Tags carry a ":latest" suffix that a configured name may omit. */
const base = (name: string) => name.replace(/:latest$/, '')

export interface ModelChoice {
  /** The model to use for the next request. */
  model: string
  /** Everything the daemon has pulled, smallest first. Empty until it answers. */
  available: AvailableModel[]
  /** True while a model other than the last-used one is loading for the first time. */
  switching: boolean
  choose: (name: string) => void
  /** Called by the caller once a request on a newly-chosen model completes. */
  settled: () => void
}

export function useModelChoice(): ModelChoice {
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [available, setAvailable] = useState<AvailableModel[]>([])
  const [switching, setSwitching] = useState(false)

  const client = useMemo(() => new OllamaClient(), [])

  // Read the remembered choice after mount, so first paint never depends on storage.
  useEffect(() => {
    try {
      const saved = storage()?.getItem(MODEL_KEY)
      if (saved) setModel(saved)
    } catch {
      // A blocked store just means the default; never a reason to fail.
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    client.listModels().then((models) => {
      if (cancelled) return
      setAvailable(models)
      /*
       * A remembered model can disappear — someone runs `ollama rm`, or opens the site against a
       * different machine. Falling back to the default beats failing every request with "not
       * pulled" until they work out where the setting lives.
       */
      setModel((current) =>
        models.length && !models.some((m) => base(m.name) === base(current)) ? DEFAULT_MODEL : current,
      )
    })
    return () => {
      cancelled = true
    }
  }, [client])

  const choose = useCallback((name: string) => {
    setModel(name)
    /*
     * Switching evicts the resident model and cold-loads the new one — tens of seconds on a card
     * that cannot hold both. The flag lets the UI say so, because silence here looks like a hang.
     */
    setSwitching(true)
    try {
      storage()?.setItem(MODEL_KEY, name)
    } catch {
      // Remembering is a convenience, not a requirement.
    }
  }, [])

  const settled = useCallback(() => setSwitching(false), [])

  return { model, available, switching, choose, settled }
}

/** "6.6 GB" — what actually decides whether a model fits the card. */
export function formatSize(bytes: number): string {
  if (!bytes) return ''
  return `${(bytes / 1e9).toFixed(1)} GB`
}
