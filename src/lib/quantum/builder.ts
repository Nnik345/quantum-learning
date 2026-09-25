/**
 * Terse builders for writing circuits by hand in source.
 *
 * Lifted out of presets.ts so exercises can author circuits the same way the worked examples are
 * authored. One implementation means a circuit written for an exercise and a circuit written for a
 * lesson cannot drift apart in how inputs or columns are set up.
 *
 * Qubit ordering follows the rest of the codebase: q0 is the top wire and the leftmost ket symbol,
 * so in a register q0 is the MOST significant bit.
 */

import { createCircuit, type Circuit, type Placement, type QubitInput } from './circuit'

let counter = 0

/** Placement builder: g(gate, targets, column, controls, params). */
export const g = (
  gate: string,
  targets: number[],
  column: number,
  controls: number[] = [],
  params: number[] = [],
): Placement => ({ id: `auto${counter++}`, gate, targets, controls, params, column })

/** The same single-qubit gate on several wires in one column. */
export const spread = (gate: string, wires: number[], column: number): Placement[] =>
  wires.map((w) => g(gate, [w], column))

/** Inputs for `n` wires, all |0⟩ except those named. */
export function inputs(
  n: number,
  overrides: Record<number, QubitInput['preset']> = {},
): QubitInput[] {
  return Array.from({ length: n }, (_, q) => ({ preset: overrides[q] ?? '0' }))
}

export const build = (
  numQubits: number,
  columns: number,
  placements: Placement[],
  overrides: Record<number, QubitInput['preset']> = {},
): Circuit => ({
  ...createCircuit(numQubits, columns),
  inputs: inputs(numQubits, overrides),
  placements,
})
