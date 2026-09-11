/** Built-in gate library: matrices plus the metadata the palette and inspector need. */

import { type Complex, c, ZERO, ONE, I } from './complex'
import type { CMatrix } from './matrix'

export type GateCategory = 'pauli' | 'hadamard' | 'phase' | 'rotation' | 'multi' | 'meta'

export interface GateParam {
  name: string
  /** Rendered in the inspector, e.g. "θ". */
  symbol: string
  default: number
}

export interface GateDef {
  id: string
  /** Symbol drawn inside the box on the circuit. */
  label: string
  name: string
  /** Number of target qubits (controls are separate and unlimited). */
  arity: number
  category: GateCategory
  params?: GateParam[]
  /** Undefined for MEASURE, which is not a unitary. */
  matrix?: (params: number[]) => CMatrix
  description: string
  /** LaTeX shown in the inspector. */
  latex?: string
}

const SQRT1_2 = Math.SQRT1_2
const e = (theta: number): Complex => c(Math.cos(theta), Math.sin(theta))

export const I_MATRIX: CMatrix = [
  [ONE, ZERO],
  [ZERO, ONE],
]
export const X_MATRIX: CMatrix = [
  [ZERO, ONE],
  [ONE, ZERO],
]
export const Y_MATRIX: CMatrix = [
  [ZERO, c(0, -1)],
  [I, ZERO],
]
export const Z_MATRIX: CMatrix = [
  [ONE, ZERO],
  [ZERO, c(-1)],
]
export const H_MATRIX: CMatrix = [
  [c(SQRT1_2), c(SQRT1_2)],
  [c(SQRT1_2), c(-SQRT1_2)],
]
export const SWAP_MATRIX: CMatrix = [
  [ONE, ZERO, ZERO, ZERO],
  [ZERO, ZERO, ONE, ZERO],
  [ZERO, ONE, ZERO, ZERO],
  [ZERO, ZERO, ZERO, ONE],
]

export const BUILTIN_GATES: GateDef[] = [
  {
    id: 'I',
    label: 'I',
    name: 'Identity',
    arity: 1,
    category: 'pauli',
    matrix: () => I_MATRIX,
    description: 'Does nothing. Useful as a placeholder or for padding a circuit.',
    latex: 'I = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}',
  },
  {
    id: 'X',
    label: 'X',
    name: 'Pauli-X (NOT)',
    arity: 1,
    category: 'pauli',
    matrix: () => X_MATRIX,
    description: 'Bit flip: swaps |0⟩ and |1⟩. A 180° rotation about the x-axis of the Bloch sphere.',
    latex: 'X = \\begin{pmatrix} 0 & 1 \\\\ 1 & 0 \\end{pmatrix}',
  },
  {
    id: 'Y',
    label: 'Y',
    name: 'Pauli-Y',
    arity: 1,
    category: 'pauli',
    matrix: () => Y_MATRIX,
    description: 'Bit and phase flip together. A 180° rotation about the y-axis.',
    latex: 'Y = \\begin{pmatrix} 0 & -i \\\\ i & 0 \\end{pmatrix}',
  },
  {
    id: 'Z',
    label: 'Z',
    name: 'Pauli-Z',
    arity: 1,
    category: 'pauli',
    matrix: () => Z_MATRIX,
    description: 'Phase flip: leaves |0⟩ alone and sends |1⟩ to −|1⟩. A 180° rotation about z.',
    latex: 'Z = \\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}',
  },
  {
    id: 'H',
    label: 'H',
    name: 'Hadamard',
    arity: 1,
    category: 'hadamard',
    matrix: () => H_MATRIX,
    description:
      'Creates superposition: |0⟩ → |+⟩ and |1⟩ → |−⟩. The usual first move in almost every algorithm.',
    latex: 'H = \\tfrac{1}{\\sqrt{2}}\\begin{pmatrix} 1 & 1 \\\\ 1 & -1 \\end{pmatrix}',
  },
  {
    id: 'S',
    label: 'S',
    name: 'Phase (S)',
    arity: 1,
    category: 'phase',
    matrix: () => [
      [ONE, ZERO],
      [ZERO, I],
    ],
    description: 'Quarter turn about z: adds a phase of i to |1⟩. S = √Z.',
    latex: 'S = \\begin{pmatrix} 1 & 0 \\\\ 0 & i \\end{pmatrix}',
  },
  {
    id: 'Sdg',
    label: 'S†',
    name: 'S-dagger',
    arity: 1,
    category: 'phase',
    matrix: () => [
      [ONE, ZERO],
      [ZERO, c(0, -1)],
    ],
    description: 'Inverse of S: adds a phase of −i to |1⟩.',
    latex: 'S^\\dagger = \\begin{pmatrix} 1 & 0 \\\\ 0 & -i \\end{pmatrix}',
  },
  {
    id: 'T',
    label: 'T',
    name: 'T (π/8)',
    arity: 1,
    category: 'phase',
    matrix: () => [
      [ONE, ZERO],
      [ZERO, e(Math.PI / 4)],
    ],
    description: 'Eighth turn about z. T² = S. Needed for universal fault-tolerant computation.',
    latex: 'T = \\begin{pmatrix} 1 & 0 \\\\ 0 & e^{i\\pi/4} \\end{pmatrix}',
  },
  {
    id: 'Tdg',
    label: 'T†',
    name: 'T-dagger',
    arity: 1,
    category: 'phase',
    matrix: () => [
      [ONE, ZERO],
      [ZERO, e(-Math.PI / 4)],
    ],
    description: 'Inverse of T.',
    latex: 'T^\\dagger = \\begin{pmatrix} 1 & 0 \\\\ 0 & e^{-i\\pi/4} \\end{pmatrix}',
  },
  {
    id: 'RX',
    label: 'Rx',
    name: 'X-rotation',
    arity: 1,
    category: 'rotation',
    params: [{ name: 'theta', symbol: 'θ', default: Math.PI / 2 }],
    matrix: ([t]) => {
      const co = c(Math.cos(t / 2))
      const si = c(0, -Math.sin(t / 2))
      return [
        [co, si],
        [si, co],
      ]
    },
    description: 'Rotate the state by θ about the x-axis of the Bloch sphere.',
    latex:
      'R_x(\\theta) = \\begin{pmatrix} \\cos\\tfrac{\\theta}{2} & -i\\sin\\tfrac{\\theta}{2} \\\\ -i\\sin\\tfrac{\\theta}{2} & \\cos\\tfrac{\\theta}{2} \\end{pmatrix}',
  },
  {
    id: 'RY',
    label: 'Ry',
    name: 'Y-rotation',
    arity: 1,
    category: 'rotation',
    params: [{ name: 'theta', symbol: 'θ', default: Math.PI / 2 }],
    matrix: ([t]) => [
      [c(Math.cos(t / 2)), c(-Math.sin(t / 2))],
      [c(Math.sin(t / 2)), c(Math.cos(t / 2))],
    ],
    description: 'Rotate the state by θ about the y-axis. Keeps real amplitudes real.',
    latex:
      'R_y(\\theta) = \\begin{pmatrix} \\cos\\tfrac{\\theta}{2} & -\\sin\\tfrac{\\theta}{2} \\\\ \\sin\\tfrac{\\theta}{2} & \\cos\\tfrac{\\theta}{2} \\end{pmatrix}',
  },
  {
    id: 'RZ',
    label: 'Rz',
    name: 'Z-rotation',
    arity: 1,
    category: 'rotation',
    params: [{ name: 'theta', symbol: 'θ', default: Math.PI / 2 }],
    matrix: ([t]) => [
      [e(-t / 2), ZERO],
      [ZERO, e(t / 2)],
    ],
    description: 'Rotate by θ about the z-axis. Changes relative phase, never the probabilities.',
    latex:
      'R_z(\\theta) = \\begin{pmatrix} e^{-i\\theta/2} & 0 \\\\ 0 & e^{i\\theta/2} \\end{pmatrix}',
  },
  {
    id: 'P',
    label: 'P',
    name: 'Phase shift',
    arity: 1,
    category: 'rotation',
    params: [{ name: 'phi', symbol: 'φ', default: Math.PI / 2 }],
    matrix: ([p]) => [
      [ONE, ZERO],
      [ZERO, e(p)],
    ],
    description: 'Adds phase φ to |1⟩ only. Generalises S (φ = π/2) and T (φ = π/4).',
    latex: 'P(\\varphi) = \\begin{pmatrix} 1 & 0 \\\\ 0 & e^{i\\varphi} \\end{pmatrix}',
  },
  {
    id: 'SWAP',
    label: 'SWAP',
    name: 'Swap',
    arity: 2,
    category: 'multi',
    matrix: () => SWAP_MATRIX,
    description: 'Exchanges the states of two qubits.',
    latex:
      '\\mathrm{SWAP} = \\begin{pmatrix} 1&0&0&0 \\\\ 0&0&1&0 \\\\ 0&1&0&0 \\\\ 0&0&0&1 \\end{pmatrix}',
  },
  {
    id: 'MEASURE',
    label: 'M',
    name: 'Measure',
    arity: 1,
    category: 'meta',
    description:
      'Measure in the computational basis. The state panel shows the pre-measurement state; run shots to see collapse.',
  },
]

export const BUILTIN_BY_ID: Record<string, GateDef> = Object.fromEntries(
  BUILTIN_GATES.map((g) => [g.id, g]),
)

/** A user-defined gate: a validated unitary plus a display label. */
export interface CustomGate {
  id: string
  label: string
  name: string
  arity: number
  /** Source expressions exactly as typed, so the editor can round-trip them. */
  source: string[][]
  matrix: CMatrix
}

export const isMeasure = (gateId: string): boolean => gateId === 'MEASURE'
export const isCustom = (gateId: string): boolean => gateId.startsWith('custom:')
export const customKey = (gateId: string): string => gateId.slice('custom:'.length)
