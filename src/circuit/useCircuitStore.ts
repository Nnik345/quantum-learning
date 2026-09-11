/**
 * Circuit state: edits, undo/redo, and debounced autosave.
 *
 * Every mutation goes through `commit`, which pushes the previous circuit onto the undo stack —
 * so there is exactly one place that can forget to make an action undoable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  MAX_COLUMNS,
  MAX_QUBITS,
  MIN_COLUMNS,
  MIN_QUBITS,
  DEFAULT_INPUT,
  buildPlacement,
  checkPlacement,
  createCircuit,
  gateDef,
  movePlacementTo,
  pruneCircuit,
  type Circuit,
  type QubitInput,
} from '../lib/quantum/circuit'
import type { CustomGate } from '../lib/quantum/gates'
import { loadFromStorage, saveToStorage } from '../lib/quantum/persist'

const HISTORY_LIMIT = 100

export interface CircuitStore {
  circuit: Circuit
  /** Non-fatal messages from the last load. Cleared by `dismissNotice`. */
  notice?: string
  canUndo: boolean
  canRedo: boolean

  addGate: (gateId: string, wire: number, column: number) => string | undefined
  moveGate: (id: string, wire: number, column: number) => boolean
  removeGate: (id: string) => void
  setTargets: (id: string, targets: number[]) => boolean
  toggleControl: (id: string, wire: number) => boolean
  setParams: (id: string, params: number[]) => void
  clear: () => void

  setQubitInput: (wire: number, input: QubitInput) => void
  resetInputs: () => void

  setNumQubits: (n: number) => void
  setColumns: (n: number) => void
  addColumnAt: (column: number) => void
  removeColumnAt: (column: number) => void

  addCustomGate: (gate: CustomGate) => void
  removeCustomGate: (key: string) => void

  replaceCircuit: (circuit: Circuit, notice?: string) => void
  undo: () => void
  redo: () => void
  dismissNotice: () => void
  /** Last rejected edit, for showing why a drop was refused. */
  lastError?: string
}

interface History {
  past: Circuit[]
  present: Circuit
  future: Circuit[]
}

export function useCircuitStore(): CircuitStore {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: createCircuit(),
    future: [],
  }))
  const [notice, setNotice] = useState<string | undefined>()
  const [lastError, setLastError] = useState<string | undefined>()
  const loaded = useRef(false)

  // Restore the autosaved circuit once, on mount.
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    const result = loadFromStorage()
    if (!result) return
    setHistory({ past: [], present: result.circuit, future: [] })
    if (result.warnings.length > 0) setNotice(result.warnings.join(' · '))
  }, [])

  // Debounced autosave.
  const circuit = history.present
  useEffect(() => {
    if (!loaded.current) return
    const timer = setTimeout(() => saveToStorage(circuit), 400)
    return () => clearTimeout(timer)
  }, [circuit])

  const commit = useCallback((update: (c: Circuit) => Circuit | undefined) => {
    setHistory((h) => {
      const next = update(h.present)
      if (!next || next === h.present) return h
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      }
    })
  }, [])

  const fail = useCallback((reason?: string) => {
    setLastError(reason)
    if (reason) setTimeout(() => setLastError((cur) => (cur === reason ? undefined : cur)), 2600)
  }, [])

  const addGate = useCallback<CircuitStore['addGate']>(
    (gateId, wire, column) => {
      const def = gateDef(circuit, gateId)
      if (!def) return undefined

      const placement = buildPlacement(circuit, gateId, wire, column)
      if (!placement) {
        fail(`${def.name} needs ${def.arity} adjacent wires`)
        return undefined
      }

      const check = checkPlacement(circuit, placement)
      if (!check.ok) {
        fail(check.reason)
        return undefined
      }
      commit((c) => ({ ...c, placements: [...c.placements, placement] }))
      return placement.id
    },
    [circuit, commit, fail],
  )

  const moveGate = useCallback<CircuitStore['moveGate']>(
    (id, wire, column) => {
      const existing = circuit.placements.find((p) => p.id === id)
      if (!existing) return false

      const moved = movePlacementTo(circuit, existing, wire, column)
      if (!moved) {
        fail('Gate would fall outside the register')
        return false
      }
      const check = checkPlacement(circuit, moved, id)
      if (!check.ok) {
        fail(check.reason)
        return false
      }
      commit((c) => ({ ...c, placements: c.placements.map((p) => (p.id === id ? moved : p)) }))
      return true
    },
    [circuit, commit, fail],
  )

  const removeGate = useCallback<CircuitStore['removeGate']>(
    (id) => commit((c) => ({ ...c, placements: c.placements.filter((p) => p.id !== id) })),
    [commit],
  )

  const setTargets = useCallback<CircuitStore['setTargets']>(
    (id, targets) => {
      const existing = circuit.placements.find((p) => p.id === id)
      if (!existing) return false
      const updated = { ...existing, targets, controls: existing.controls.filter((c) => !targets.includes(c)) }
      const check = checkPlacement(circuit, updated, id)
      if (!check.ok) {
        fail(check.reason)
        return false
      }
      commit((c) => ({ ...c, placements: c.placements.map((p) => (p.id === id ? updated : p)) }))
      return true
    },
    [circuit, commit, fail],
  )

  const toggleControl = useCallback<CircuitStore['toggleControl']>(
    (id, wire) => {
      const existing = circuit.placements.find((p) => p.id === id)
      if (!existing) return false
      if (existing.targets.includes(wire)) {
        fail('That wire is already a target of this gate')
        return false
      }
      const controls = existing.controls.includes(wire)
        ? existing.controls.filter((c) => c !== wire)
        : [...existing.controls, wire].sort((a, b) => a - b)

      const updated = { ...existing, controls }
      const check = checkPlacement(circuit, updated, id)
      if (!check.ok) {
        fail(check.reason)
        return false
      }
      commit((c) => ({ ...c, placements: c.placements.map((p) => (p.id === id ? updated : p)) }))
      return true
    },
    [circuit, commit, fail],
  )

  const setParams = useCallback<CircuitStore['setParams']>(
    (id, params) =>
      commit((c) => ({
        ...c,
        placements: c.placements.map((p) => (p.id === id ? { ...p, params } : p)),
      })),
    [commit],
  )

  const setQubitInput = useCallback<CircuitStore['setQubitInput']>(
    (wire, input) =>
      commit((c) => ({
        ...c,
        inputs: c.inputs.map((existing, q) => (q === wire ? input : existing)),
      })),
    [commit],
  )

  const resetInputs = useCallback<CircuitStore['resetInputs']>(
    () =>
      commit((c) => ({ ...c, inputs: c.inputs.map(() => ({ ...DEFAULT_INPUT })) })),
    [commit],
  )

  const setNumQubits = useCallback<CircuitStore['setNumQubits']>(
    (n) => {
      const numQubits = Math.min(MAX_QUBITS, Math.max(MIN_QUBITS, n))
      // pruneCircuit resizes the inputs array to match, so new wires start at |0⟩.
      commit((c) => pruneCircuit({ ...c, numQubits }))
    },
    [commit],
  )

  const setColumns = useCallback<CircuitStore['setColumns']>(
    (n) => {
      const columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, n))
      commit((c) => pruneCircuit({ ...c, columns }))
    },
    [commit],
  )

  const addColumnAt = useCallback<CircuitStore['addColumnAt']>(
    (column) =>
      commit((c) => ({
        ...c,
        columns: Math.min(MAX_COLUMNS, c.columns + 1),
        placements: c.placements.map((p) => (p.column >= column ? { ...p, column: p.column + 1 } : p)),
      })),
    [commit],
  )

  const removeColumnAt = useCallback<CircuitStore['removeColumnAt']>(
    (column) =>
      commit((c) => ({
        ...c,
        columns: Math.max(MIN_COLUMNS, c.columns - 1),
        placements: c.placements
          .filter((p) => p.column !== column)
          .map((p) => (p.column > column ? { ...p, column: p.column - 1 } : p)),
      })),
    [commit],
  )

  const addCustomGate = useCallback<CircuitStore['addCustomGate']>(
    (gate) => commit((c) => ({ ...c, customGates: { ...c.customGates, [gate.id]: gate } })),
    [commit],
  )

  const removeCustomGate = useCallback<CircuitStore['removeCustomGate']>(
    (key) =>
      commit((c) => {
        const { [key]: _removed, ...rest } = c.customGates
        return {
          ...c,
          customGates: rest,
          placements: c.placements.filter((p) => p.gate !== `custom:${key}`),
        }
      }),
    [commit],
  )

  const clear = useCallback(() => commit((c) => ({ ...c, placements: [] })), [commit])

  const replaceCircuit = useCallback<CircuitStore['replaceCircuit']>(
    (next, message) => {
      commit(() => next)
      setNotice(message)
    },
    [commit],
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future].slice(0, HISTORY_LIMIT),
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h
      return {
        past: [...h.past, h.present].slice(-HISTORY_LIMIT),
        present: h.future[0],
        future: h.future.slice(1),
      }
    })
  }, [])

  return useMemo(
    () => ({
      circuit,
      notice,
      lastError,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      addGate,
      moveGate,
      removeGate,
      setTargets,
      toggleControl,
      setParams,
      setQubitInput,
      resetInputs,
      clear,
      setNumQubits,
      setColumns,
      addColumnAt,
      removeColumnAt,
      addCustomGate,
      removeCustomGate,
      replaceCircuit,
      undo,
      redo,
      dismissNotice: () => setNotice(undefined),
    }),
    [
      circuit,
      notice,
      lastError,
      history.past.length,
      history.future.length,
      addGate,
      moveGate,
      removeGate,
      setTargets,
      toggleControl,
      setParams,
      setQubitInput,
      resetInputs,
      clear,
      setNumQubits,
      setColumns,
      addColumnAt,
      removeColumnAt,
      addCustomGate,
      removeCustomGate,
      replaceCircuit,
      undo,
      redo,
    ],
  )
}
