import { useCallback, useEffect, useRef, useState } from 'react'

import { health, runPython, type PythonHealth, type PythonRun } from './client'
import { fromQiskitOrder } from './qiskitOrder'
import { validateProposal, type ValidationResult } from '../llm/validate'

/**
 * Running Python and turning whatever came back into a circuit.
 *
 * Shared by the playground and the guided lessons so both follow the identical path: run, extract
 * Qiskit's circuit, flip it into this site's wire order, then validate it with the same validator
 * that guards the tutor's circuits. A lesson and a free experiment cannot disagree about what a
 * program built.
 */
export interface RunnerState {
  run?: PythonRun
  /** The learner's circuit, converted and validated, when their program built one. */
  circuit?: ValidationResult
  /** Instructions the board could not draw, and out-of-range wires. */
  notes: string[]
  busy: boolean
  /** Set when the service could not be reached at all, as opposed to the script raising. */
  failure?: string
  service?: PythonHealth
  execute: (code: string) => Promise<ValidationResult | undefined>
  reset: () => void
}

export function usePythonRunner(): RunnerState {
  const [run, setRun] = useState<PythonRun>()
  const [circuit, setCircuit] = useState<ValidationResult>()
  const [notes, setNotes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()
  const [service, setService] = useState<PythonHealth>()
  const abort = useRef<AbortController>()

  useEffect(() => {
    const controller = new AbortController()
    health(controller.signal).then(setService)
    return () => controller.abort()
  }, [])

  const reset = useCallback(() => {
    setRun(undefined)
    setCircuit(undefined)
    setNotes([])
    setFailure(undefined)
  }, [])

  const execute = useCallback(async (code: string) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller

    setBusy(true)
    setFailure(undefined)
    setCircuit(undefined)
    setNotes([])

    try {
      const result = await runPython(code, controller.signal)
      setRun(result)

      if (!result.circuit) return undefined

      const { proposal, errors } = fromQiskitOrder(result.circuit)
      const unsupported = (result.circuit.unsupported ?? []).map(
        (name) => `“${name}” has no equivalent on this board, so it was left out of the drawing.`,
      )
      setNotes([...errors, ...unsupported])

      if (!proposal) return undefined
      const validated = validateProposal(proposal)
      setCircuit(validated)
      return validated
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return undefined
      setFailure(err instanceof Error ? err.message : String(err))
      setRun(undefined)
      return undefined
    } finally {
      setBusy(false)
    }
  }, [])

  return { run, circuit, notes, busy, failure, service, execute, reset }
}
