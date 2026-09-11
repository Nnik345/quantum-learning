/** Drag interactions on the circuit grid. */

export type DragState =
  /** Dragging a fresh gate out of the palette. */
  | { kind: 'new'; gateId: string; label: string }
  /** Moving a gate already on the grid. */
  | { kind: 'move'; id: string; label: string }
  /** Dragging the control handle of a selected gate onto another wire. */
  | { kind: 'control'; id: string; label: string }

export interface Pointer {
  x: number
  y: number
}
