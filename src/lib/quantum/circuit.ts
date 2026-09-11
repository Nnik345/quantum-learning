/** Circuit model: placements on a qubit × column grid, plus the rules for what may go where. */

import { type Complex, abs2, c } from './complex'
import type { CMatrix } from './matrix'
import { BUILTIN_BY_ID, type CustomGate, type GateDef, isCustom, customKey, isMeasure } from './gates'
import { parseComplex } from './parseComplex'
import { MAX_QUBITS } from './state'

export const MIN_QUBITS = 1
export { MAX_QUBITS }
export const MIN_COLUMNS = 4
export const MAX_COLUMNS = 64

export interface Placement {
  id: string
  /** Built-in id ("H") or "custom:<key>". */
  gate: string
  /** Target wires, in order. targets[0] is the gate's most significant qubit. */
  targets: number[]
  /** Positive controls. Always disjoint from targets. */
  controls: number[]
  /** Values for the gate's params, in declaration order. */
  params: number[]
  column: number
}

// ---------------------------------------------------------------------------
// Qubit inputs
//
// Each wire starts in a state of its own choosing rather than always |0⟩. Inputs are per-qubit,
// so the starting register is always a product state — an entangled input cannot be expressed by
// a per-wire control, and pretending otherwise would be misleading.
// ---------------------------------------------------------------------------

export type InputPresetId = '0' | '1' | '+' | '-' | 'i' | '-i'

export interface InputPreset {
  id: InputPresetId
  /** How it is written, e.g. "|+⟩". */
  ket: string
  name: string
  latex: string
  amplitudes: [Complex, Complex]
}

const R = Math.SQRT1_2

export const INPUT_PRESETS: InputPreset[] = [
  { id: '0', ket: '|0⟩', name: 'Ground state', latex: '|0\\rangle', amplitudes: [c(1), c(0)] },
  { id: '1', ket: '|1⟩', name: 'Excited state', latex: '|1\\rangle', amplitudes: [c(0), c(1)] },
  {
    id: '+',
    ket: '|+⟩',
    name: 'Plus (X basis)',
    latex: '|+\\rangle = \\tfrac{1}{\\sqrt2}(|0\\rangle + |1\\rangle)',
    amplitudes: [c(R), c(R)],
  },
  {
    id: '-',
    ket: '|−⟩',
    name: 'Minus (X basis)',
    latex: '|-\\rangle = \\tfrac{1}{\\sqrt2}(|0\\rangle - |1\\rangle)',
    amplitudes: [c(R), c(-R)],
  },
  {
    id: 'i',
    ket: '|i⟩',
    name: 'Plus-i (Y basis)',
    latex: '|i\\rangle = \\tfrac{1}{\\sqrt2}(|0\\rangle + i|1\\rangle)',
    amplitudes: [c(R), c(0, R)],
  },
  {
    id: '-i',
    ket: '|−i⟩',
    name: 'Minus-i (Y basis)',
    latex: '|-i\\rangle = \\tfrac{1}{\\sqrt2}(|0\\rangle - i|1\\rangle)',
    amplitudes: [c(R), c(0, -R)],
  },
]

export const INPUT_PRESET_BY_ID: Record<string, InputPreset> = Object.fromEntries(
  INPUT_PRESETS.map((p) => [p.id, p]),
)

export interface QubitInput {
  preset: InputPresetId | 'custom'
  /** Source expressions for α and β, used only when preset is 'custom'. */
  source?: [string, string]
}

export const DEFAULT_INPUT: QubitInput = { preset: '0' }

/**
 * Tolerance on |α|² + |β|² = 1.
 *
 * Deliberately looser than the unitarity check on gate matrices: amplitudes here are typed by
 * hand, and `0.707107` is a perfectly reasonable way to write 1/√2. Anything accepted is then
 * rescaled to exactly unit norm, so a value near the edge of this tolerance still produces a
 * numerically exact simulation.
 */
export const NORM_TOLERANCE = 1e-6

export interface InputResolution {
  amplitudes?: [Complex, Complex]
  error?: string
}

/** Resolve one wire's input to amplitudes, reporting why if it cannot be used. */
export function resolveInput(input: QubitInput): InputResolution {
  if (input.preset !== 'custom') {
    const preset = INPUT_PRESET_BY_ID[input.preset]
    if (!preset) return { error: `Unknown input preset "${input.preset}"` }
    return { amplitudes: preset.amplitudes }
  }

  const [alphaSrc, betaSrc] = input.source ?? ['1', '0']
  let alpha: Complex
  let beta: Complex
  try {
    alpha = parseComplex(alphaSrc)
  } catch (err) {
    return { error: `α: ${err instanceof Error ? err.message : 'invalid'}` }
  }
  try {
    beta = parseComplex(betaSrc)
  } catch (err) {
    return { error: `β: ${err instanceof Error ? err.message : 'invalid'}` }
  }

  const norm = abs2(alpha) + abs2(beta)
  if (Math.abs(norm - 1) > NORM_TOLERANCE) {
    return { error: `Not normalised: |α|² + |β|² = ${norm.toFixed(6)}, must be 1` }
  }

  // Rescale away any residual rounding from hand-typed decimals, so the state fed to the
  // simulator has exactly unit norm and probabilities sum to exactly 1.
  const s = 1 / Math.sqrt(norm)
  return { amplitudes: [scaleComplex(alpha, s), scaleComplex(beta, s)] }
}

const scaleComplex = (z: Complex, s: number): Complex => ({ re: z.re * s, im: z.im * s })

/** How an input is labelled on its wire. */
export function inputKet(input: QubitInput): string {
  if (input.preset !== 'custom') return INPUT_PRESET_BY_ID[input.preset]?.ket ?? '|?⟩'
  return '|ψ⟩'
}

/**
 * Amplitudes for every wire. An invalid input falls back to |0⟩ and is reported rather than
 * throwing, so one bad entry cannot take down the whole simulation.
 */
export function circuitInputAmplitudes(circuit: Circuit): {
  amplitudes: [Complex, Complex][]
  errors: string[]
} {
  const errors: string[] = []
  const amplitudes = Array.from({ length: circuit.numQubits }, (_, q) => {
    const { amplitudes: amps, error } = resolveInput(circuit.inputs[q] ?? DEFAULT_INPUT)
    if (error) {
      errors.push(`q${q} input — ${error}`)
      return INPUT_PRESET_BY_ID['0'].amplitudes
    }
    return amps!
  })
  return { amplitudes, errors }
}

/** True when every wire starts in |0⟩, i.e. nothing about the input needs explaining. */
export const hasDefaultInputs = (circuit: Circuit): boolean =>
  circuit.inputs.every((i) => i.preset === '0')

// ---------------------------------------------------------------------------

export interface Circuit {
  numQubits: number
  columns: number
  placements: Placement[]
  customGates: Record<string, CustomGate>
  /** One entry per wire; always kept the same length as `numQubits`. */
  inputs: QubitInput[]
}

export function createCircuit(numQubits = 3, columns = 8): Circuit {
  return {
    numQubits,
    columns,
    placements: [],
    customGates: {},
    inputs: Array.from({ length: numQubits }, () => ({ ...DEFAULT_INPUT })),
  }
}

/** Grow or shrink the inputs array to match the qubit count, defaulting new wires to |0⟩. */
export function resizeInputs(inputs: QubitInput[], numQubits: number): QubitInput[] {
  return Array.from({ length: numQubits }, (_, q) => inputs[q] ?? { ...DEFAULT_INPUT })
}

let idCounter = 0
export const newPlacementId = (): string => `p${Date.now().toString(36)}${(idCounter++).toString(36)}`

/** Resolve a gate id to its definition, including user-defined gates. */
export function gateDef(circuit: Circuit, gateId: string): GateDef | undefined {
  if (isCustom(gateId)) {
    const custom = circuit.customGates[customKey(gateId)]
    if (!custom) return undefined
    return {
      id: gateId,
      label: custom.label,
      name: custom.name,
      arity: custom.arity,
      category: 'multi',
      matrix: () => custom.matrix,
      description: 'User-defined gate.',
    }
  }
  return BUILTIN_BY_ID[gateId]
}

/** The matrix a placement actually applies, with its parameters baked in. */
export function resolveMatrix(circuit: Circuit, p: Placement): CMatrix | undefined {
  const def = gateDef(circuit, p.gate)
  if (!def?.matrix) return undefined
  return def.matrix(p.params)
}

/**
 * Wires a placement occupies in its column.
 *
 * This is the full span from its topmost to its bottommost wire — not just the target and control
 * wires themselves — because the vertical control line is drawn through everything in between.
 * Anything else would let a gate be dropped underneath a control line and render as a tangle.
 */
export function spanOf(p: Placement): { top: number; bottom: number } {
  const wires = [...p.targets, ...p.controls]
  return { top: Math.min(...wires), bottom: Math.max(...wires) }
}

export const occupiesWire = (p: Placement, wire: number): boolean => {
  const { top, bottom } = spanOf(p)
  return wire >= top && wire <= bottom
}

export interface PlacementCheck {
  ok: boolean
  reason?: string
}

/** Whether `candidate` is a legal placement. `ignoreId` skips a placement being moved or edited. */
export function checkPlacement(
  circuit: Circuit,
  candidate: Placement,
  ignoreId?: string,
): PlacementCheck {
  const def = gateDef(circuit, candidate.gate)
  if (!def) return { ok: false, reason: `Unknown gate "${candidate.gate}"` }

  if (candidate.targets.length !== def.arity) {
    return { ok: false, reason: `${def.name} needs exactly ${def.arity} target wire(s)` }
  }
  if (candidate.column < 0 || candidate.column >= circuit.columns) {
    return { ok: false, reason: 'Column is outside the circuit' }
  }

  const wires = [...candidate.targets, ...candidate.controls]
  if (new Set(wires).size !== wires.length) {
    return { ok: false, reason: 'A wire cannot be used twice by the same gate' }
  }
  for (const w of wires) {
    if (w < 0 || w >= circuit.numQubits) return { ok: false, reason: `Wire q${w} does not exist` }
  }
  if (isMeasure(candidate.gate) && candidate.controls.length > 0) {
    return { ok: false, reason: 'Measurement cannot be controlled' }
  }

  const { top, bottom } = spanOf(candidate)
  for (const other of circuit.placements) {
    if (other.id === ignoreId || other.column !== candidate.column) continue
    const o = spanOf(other)
    if (top <= o.bottom && bottom >= o.top) {
      const otherLabel = gateDef(circuit, other.gate)?.label ?? other.gate
      // A gate that spans wires is blocked by its vertical link, not by the gate box itself.
      // Saying only "overlaps" makes that look like a bug rather than a drawing constraint.
      const reason =
        bottom > top
          ? `Its link from q${top} to q${bottom} would cross ${otherLabel} in this column — put it in another column`
          : `${otherLabel} already occupies q${top} in this column`
      return { ok: false, reason }
    }
  }
  return { ok: true }
}

/**
 * Wires a gate of the given arity would occupy if dropped on `wire`.
 * Multi-qubit gates take consecutive wires, preferring downward and falling back upward at the
 * bottom edge. Returns undefined when the register is too small.
 */
export function targetsForDrop(
  numQubits: number,
  arity: number,
  wire: number,
): number[] | undefined {
  if (arity <= 1) return [wire]
  const down = Array.from({ length: arity }, (_, i) => wire + i)
  if (down[arity - 1] < numQubits) return down
  const up = Array.from({ length: arity }, (_, i) => wire - arity + 1 + i)
  return up[0] >= 0 ? up : undefined
}

/**
 * Build the placement a palette drop would create. Shared by the drag preview and the actual
 * insert so the ghost can never promise something the drop then refuses.
 */
export function buildPlacement(
  circuit: Circuit,
  gateId: string,
  wire: number,
  column: number,
  id = newPlacementId(),
): Placement | undefined {
  const def = gateDef(circuit, gateId)
  if (!def) return undefined
  const targets = targetsForDrop(circuit.numQubits, def.arity, wire)
  if (!targets) return undefined
  return {
    id,
    gate: gateId,
    targets,
    controls: [],
    params: def.params?.map((p) => p.default) ?? [],
    column,
  }
}

/**
 * Move a placement rigidly so its topmost wire lands on `wire`, preserving the relative offsets
 * of its targets and controls. Returns undefined if that would push it off the register.
 */
export function movePlacementTo(
  circuit: Circuit,
  placement: Placement,
  wire: number,
  column: number,
): Placement | undefined {
  const delta = wire - spanOf(placement).top
  const moved: Placement = {
    ...placement,
    column,
    targets: placement.targets.map((t) => t + delta),
    controls: placement.controls.map((c) => c + delta),
  }
  const wires = [...moved.targets, ...moved.controls]
  if (wires.some((w) => w < 0 || w >= circuit.numQubits)) return undefined
  return moved
}

/** Placement occupying `wire` in `column`, if any. */
export function placementAt(circuit: Circuit, wire: number, column: number): Placement | undefined {
  return circuit.placements.find((p) => p.column === column && occupiesWire(p, wire))
}

export const placementsInColumn = (circuit: Circuit, column: number): Placement[] =>
  circuit.placements.filter((p) => p.column === column)

/** Last column containing anything, or -1. Drives auto-grow and the step transport's end. */
export function lastUsedColumn(circuit: Circuit): number {
  return circuit.placements.reduce((max, p) => Math.max(max, p.column), -1)
}

export const hasMeasurement = (circuit: Circuit): boolean =>
  circuit.placements.some((p) => isMeasure(p.gate))

/**
 * Drop placements that no longer fit — used when shrinking the register or the column count so the
 * circuit can never hold a placement pointing at a wire that isn't there.
 */
export function pruneCircuit(circuit: Circuit): Circuit {
  return {
    ...circuit,
    inputs: resizeInputs(circuit.inputs, circuit.numQubits),
    placements: circuit.placements.filter((p) => {
      const wires = [...p.targets, ...p.controls]
      return (
        p.column < circuit.columns && wires.every((w) => w >= 0 && w < circuit.numQubits)
      )
    }),
  }
}

// ---------------------------------------------------------------------------
// Serialisation
//
// Kept standalone and version-tagged so other exporters (OpenQASM, Qiskit) can be added later
// without touching the UI.
// ---------------------------------------------------------------------------

export const CIRCUIT_FORMAT_VERSION = 1

export interface SerialisedCircuit {
  version: number
  numQubits: number
  columns: number
  placements: Placement[]
  customGates: Record<string, Omit<CustomGate, 'matrix'>>
  inputs: QubitInput[]
}

export function serialiseCircuit(circuit: Circuit): SerialisedCircuit {
  const customGates: Record<string, Omit<CustomGate, 'matrix'>> = {}
  for (const [key, g] of Object.entries(circuit.customGates)) {
    // Only the source expressions are stored; the matrix is re-derived and re-validated on load.
    const { matrix: _matrix, ...rest } = g
    customGates[key] = rest
  }
  return {
    version: CIRCUIT_FORMAT_VERSION,
    numQubits: circuit.numQubits,
    columns: circuit.columns,
    placements: circuit.placements,
    customGates,
    inputs: resizeInputs(circuit.inputs, circuit.numQubits),
  }
}
