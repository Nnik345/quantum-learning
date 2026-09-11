/**
 * Loading and saving circuits.
 *
 * Custom gates are stored as their source expressions, never as numbers, so a loaded gate is
 * re-parsed and re-checked for unitarity. That way a hand-edited or corrupted file can't smuggle a
 * non-unitary "gate" into the simulator.
 */

import {
  CIRCUIT_FORMAT_VERSION,
  DEFAULT_INPUT,
  MAX_COLUMNS,
  MAX_QUBITS,
  MIN_COLUMNS,
  MIN_QUBITS,
  createCircuit,
  pruneCircuit,
  resolveInput,
  serialiseCircuit,
  type Circuit,
  type Placement,
  type QubitInput,
  type SerialisedCircuit,
} from './circuit'
import type { CustomGate } from './gates'
import { isUnitary } from './matrix'
import { parseComplex } from './parseComplex'

export const STORAGE_KEY = 'quantum-learning:circuit:v1'

export interface LoadResult {
  circuit: Circuit
  warnings: string[]
}

const clamp = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo

/** Rebuild a custom gate from its stored source, re-validating it. */
function reviveCustomGate(raw: unknown, warnings: string[]): CustomGate | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const g = raw as Partial<CustomGate>
  if (typeof g.id !== 'string' || !Array.isArray(g.source)) return undefined

  const size = g.source.length
  if (size < 2 || (size & (size - 1)) !== 0 || g.source.some((r) => !Array.isArray(r) || r.length !== size)) {
    warnings.push(`Custom gate "${g.id}" has a malformed matrix and was dropped`)
    return undefined
  }

  try {
    const matrix = g.source.map((row) => row.map((cell) => parseComplex(String(cell))))
    const check = isUnitary(matrix)
    if (!check.ok) {
      warnings.push(
        `Custom gate "${g.id}" is not unitary (deviation ${check.maxDeviation.toExponential(2)}) and was dropped`,
      )
      return undefined
    }
    return {
      id: g.id,
      label: typeof g.label === 'string' ? g.label : g.id,
      name: typeof g.name === 'string' ? g.name : g.id,
      arity: Math.log2(size),
      source: g.source.map((row) => row.map(String)),
      matrix,
    }
  } catch (err) {
    warnings.push(
      `Custom gate "${g.id}" could not be parsed (${err instanceof Error ? err.message : 'unknown error'}) and was dropped`,
    )
    return undefined
  }
}

/** Rebuild one wire's input, falling back to |0⟩ if it is malformed or unnormalised. */
function reviveInput(raw: unknown, wire: number, warnings: string[]): QubitInput {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_INPUT }
  const input = raw as Partial<QubitInput>

  const candidate: QubitInput =
    input.preset === 'custom'
      ? {
          preset: 'custom',
          source: [String(input.source?.[0] ?? '1'), String(input.source?.[1] ?? '0')],
        }
      : { preset: (input.preset ?? '0') as QubitInput['preset'] }

  const { error } = resolveInput(candidate)
  if (error) {
    warnings.push(`q${wire} input was invalid (${error}) and was reset to |0⟩`)
    return { ...DEFAULT_INPUT }
  }
  return candidate
}

function revivePlacement(raw: unknown): Placement | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const p = raw as Partial<Placement>
  if (typeof p.gate !== 'string' || !Array.isArray(p.targets) || p.targets.length === 0) {
    return undefined
  }
  const ints = (xs: unknown): number[] =>
    Array.isArray(xs) ? xs.filter((x): x is number => Number.isInteger(x)) : []

  return {
    id: typeof p.id === 'string' ? p.id : `p${Math.random().toString(36).slice(2)}`,
    gate: p.gate,
    targets: ints(p.targets),
    controls: ints(p.controls),
    params: Array.isArray(p.params) ? p.params.filter((x): x is number => Number.isFinite(x)) : [],
    column: Number.isInteger(p.column) ? (p.column as number) : 0,
  }
}

/** Parse an untrusted object into a circuit, salvaging what is valid and reporting the rest. */
export function deserialiseCircuit(raw: unknown): LoadResult {
  const warnings: string[] = []
  const fallback = () => ({ circuit: createCircuit(), warnings })

  if (typeof raw !== 'object' || raw === null) {
    warnings.push('File does not contain a circuit object')
    return fallback()
  }

  const data = raw as Partial<SerialisedCircuit>
  if (data.version !== undefined && data.version > CIRCUIT_FORMAT_VERSION) {
    warnings.push(
      `File was written by a newer version (format ${data.version}); loading it as best we can`,
    )
  }

  const customGates: Record<string, CustomGate> = {}
  for (const [key, value] of Object.entries(data.customGates ?? {})) {
    const gate = reviveCustomGate(value, warnings)
    if (gate) customGates[key] = gate
  }

  const numQubits = clamp(Number(data.numQubits), MIN_QUBITS, MAX_QUBITS)
  const rawInputs = Array.isArray(data.inputs) ? data.inputs : []

  const circuit: Circuit = {
    numQubits,
    columns: clamp(Number(data.columns), MIN_COLUMNS, MAX_COLUMNS),
    customGates,
    // Files written before inputs existed simply have none, and every wire defaults to |0⟩.
    inputs: Array.from({ length: numQubits }, (_, q) => reviveInput(rawInputs[q], q, warnings)),
    placements: (Array.isArray(data.placements) ? data.placements : [])
      .map(revivePlacement)
      .filter((p): p is Placement => p !== undefined)
      // A placement referencing a gate that failed to load would silently vanish from the
      // simulation, so drop it here and say so.
      .filter((p) => {
        if (!p.gate.startsWith('custom:')) return true
        const key = p.gate.slice('custom:'.length)
        if (customGates[key]) return true
        warnings.push(`Dropped a placement using missing custom gate "${key}"`)
        return false
      }),
  }

  const before = circuit.placements.length
  const pruned = pruneCircuit(circuit)
  if (pruned.placements.length !== before) {
    warnings.push(`Dropped ${before - pruned.placements.length} placement(s) outside the grid`)
  }

  return { circuit: pruned, warnings }
}

/**
 * Reached through `window` rather than the bare global: recent Node versions define their own
 * `localStorage` global that is undefined unless the process was started with a storage file, and
 * it shadows the one the DOM provides.
 */
const storage = (): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined // blocked by browser site-data settings
  }
}

export function saveToStorage(circuit: Circuit): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(serialiseCircuit(circuit)))
  } catch {
    // Private browsing or a full quota — autosave is a convenience, never a requirement.
  }
}

export function loadFromStorage(): LoadResult | undefined {
  try {
    const raw = storage()?.getItem(STORAGE_KEY)
    if (!raw) return undefined
    return deserialiseCircuit(JSON.parse(raw))
  } catch {
    return undefined
  }
}

export function clearStorage(): void {
  try {
    storage()?.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const circuitToJson = (circuit: Circuit): string =>
  JSON.stringify(serialiseCircuit(circuit), null, 2)
