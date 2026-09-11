/** Shared circuit-grid geometry, so the renderer and the hit-testing can never disagree. */

// Wide enough for "q7" plus the input button, which has to fit "|−i⟩".
export const LABEL_W = 96
export const INPUT_BTN_X = 32
export const INPUT_BTN_W = 56
export const INPUT_BTN_H = 24
export const HEADER_H = 30
export const CELL_W = 58
export const CELL_H = 54
export const GATE_SIZE = 38

export const wireY = (wire: number): number => HEADER_H + wire * CELL_H + CELL_H / 2
export const columnX = (column: number): number => LABEL_W + column * CELL_W + CELL_W / 2

export const gridWidth = (columns: number): number => LABEL_W + columns * CELL_W + 10
export const gridHeight = (numQubits: number): number => HEADER_H + numQubits * CELL_H + 12

export interface Cell {
  wire: number
  column: number
}

/**
 * Map a point in SVG user space to a grid cell, or null if it is outside the wire area.
 * A small tolerance past the last wire keeps drops near the bottom edge from being lost.
 */
export function cellFromPoint(
  x: number,
  y: number,
  numQubits: number,
  columns: number,
): Cell | null {
  if (x < LABEL_W || y < HEADER_H) return null
  const column = Math.floor((x - LABEL_W) / CELL_W)
  const wire = Math.floor((y - HEADER_H) / CELL_H)
  if (column < 0 || column >= columns || wire < 0 || wire >= numQubits) return null
  return { wire, column }
}

/** Convert client coordinates to SVG user space, accounting for scroll and CSS scaling. */
export function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  // viewBox.baseVal is absent in some non-browser DOM implementations; fall back to 1:1.
  const box = svg.viewBox?.baseVal
  const scaleX = box?.width && rect.width ? box.width / rect.width : 1
  const scaleY = box?.height && rect.height ? box.height / rect.height : 1
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
}

export const GATE_COLORS: Record<string, { stroke: string; fill: string; text: string }> = {
  pauli: { stroke: '#a78bfa', fill: '#241b45', text: '#c9b8ff' },
  hadamard: { stroke: '#22d3ee', fill: '#0d3543', text: '#7fe6f7' },
  phase: { stroke: '#fbbf24', fill: '#3a2c0c', text: '#fcd571' },
  rotation: { stroke: '#34d399', fill: '#0e3529', text: '#7ee7c0' },
  multi: { stroke: '#a78bfa', fill: '#241b45', text: '#c9b8ff' },
  meta: { stroke: '#6b7d9c', fill: '#1a2338', text: '#9fb0cc' },
}

export const colorsFor = (category: string) => GATE_COLORS[category] ?? GATE_COLORS.multi
