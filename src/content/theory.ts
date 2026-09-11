/**
 * THEORY TRACK — placeholder content.
 *
 * Same rules as math.ts: titles, ordering and section counts are yours to change. `dirac-notation`
 * and `bloch-sphere` each have one worked section as a demonstration; everything else is a stub.
 */

import type { Topic } from './types'

const diracNotation: Topic = {
  slug: 'dirac-notation',
  title: 'Dirac Notation',
  blurb: 'Bras, kets, and why physicists stopped writing column vectors.',
  estMinutes: 25,
  sections: [
    {
      id: 'kets',
      title: 'Kets: Writing a Quantum State',
      summary: 'A column vector with a suggestive label.',
      status: 'draft',
      blocks: [
        {
          kind: 'text',
          text: 'A ket $|\\psi\\rangle$ is just a column vector. The notation earns its keep because the label inside the bracket can be anything meaningful — $|0\\rangle$, $|{\\uparrow}\\rangle$, $|\\text{alive}\\rangle$ — instead of an anonymous $v_1$.',
        },
        { kind: 'math', tex: '|0\\rangle = \\begin{pmatrix} 1 \\\\ 0 \\end{pmatrix}, \\qquad |1\\rangle = \\begin{pmatrix} 0 \\\\ 1 \\end{pmatrix}' },
        {
          kind: 'text',
          text: 'A general single-qubit state is a superposition $|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$ with $|\\alpha|^2 + |\\beta|^2 = 1$.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Ordering convention on this site',
          text: 'Qubit $q_0$ is the **top wire** of a circuit and the **leftmost symbol** in a ket, so $|q_0 q_1 q_2\\rangle$. This is textbook ordering; note that Qiskit prints bitstrings the other way round.',
        },
      ],
    },
    { id: 'bras', title: 'Bras and the Inner Product', summary: '$\\langle\\phi|\\psi\\rangle$ as overlap.' },
    { id: 'normalisation', title: 'Normalisation' },
    { id: 'outer-products', title: 'Outer Products and Projectors' },
    { id: 'basis-change', title: 'Changing Basis', summary: 'The same state seen in the $X$ basis.' },
  ],
}

const qubitsBloch: Topic = {
  slug: 'qubits-and-the-bloch-sphere',
  title: 'Qubits & the Bloch Sphere',
  blurb: 'Every pure single-qubit state as a point on a sphere you can rotate.',
  estMinutes: 30,
  sections: [
    {
      id: 'the-sphere',
      title: 'The Sphere',
      summary: 'Two real parameters are enough to describe any pure qubit state.',
      status: 'draft',
      blocks: [
        {
          kind: 'text',
          text: 'A single-qubit state has two complex amplitudes — four real numbers. Normalisation removes one, and global phase is unobservable, which removes another. Two real parameters remain, so every pure state is a point on the surface of a sphere.',
        },
        { kind: 'math', tex: '|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}\\,|0\\rangle + e^{i\\varphi}\\sin\\tfrac{\\theta}{2}\\,|1\\rangle' },
        { kind: 'widget', widget: 'bloch-sphere', caption: 'Drag to orbit. Apply gates and watch the state rotate.' },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'The sphere only covers ONE qubit',
          text: 'There is no Bloch sphere for two entangled qubits. When a qubit is entangled, its arrow shrinks inside the sphere — you can see exactly this on the circuit page after building a Bell state.',
        },
      ],
    },
    { id: 'poles-and-equator', title: 'Poles, Equator, and the Six Cardinal States' },
    { id: 'global-phase', title: 'Global vs Relative Phase', summary: 'One is invisible, one is everything.' },
    { id: 'rotations', title: 'Gates as Rotations' },
    { id: 'mixed-states', title: 'Inside the Sphere: Mixed States' },
  ],
}

const gates: Topic = {
  slug: 'quantum-gates',
  title: 'Quantum Gates',
  blurb: 'The unitary building blocks, what each one does, and why reversibility is forced.',
  estMinutes: 40,
  sections: [
    { id: 'unitarity', title: 'Why Gates Must Be Unitary' },
    { id: 'pauli', title: 'The Pauli Gates: X, Y, Z' },
    { id: 'hadamard', title: 'The Hadamard Gate' },
    { id: 'phase-gates', title: 'Phase Gates: S and T' },
    { id: 'rotations', title: 'Rotation Gates: RX, RY, RZ' },
    { id: 'cnot', title: 'CNOT and Controlled Gates' },
    { id: 'toffoli', title: 'Toffoli and Multi-Control' },
    { id: 'universality', title: 'Universal Gate Sets' },
  ],
}

const tensorProducts: Topic = {
  slug: 'tensor-products',
  title: 'Tensor Products',
  blurb: 'How two qubits combine into one four-dimensional state — and why that grows so fast.',
  estMinutes: 30,
  sections: [
    { id: 'motivation', title: 'Combining Two Systems' },
    { id: 'kronecker', title: 'The Kronecker Product' },
    { id: 'notation', title: 'Notation: $|0\\rangle \\otimes |1\\rangle = |01\\rangle$' },
    { id: 'gates-on-registers', title: 'Applying a Gate to One Qubit of Many' },
    { id: 'exponential-growth', title: 'Why $2^n$ Is the Whole Story' },
  ],
}

const entanglement: Topic = {
  slug: 'entanglement',
  title: 'Entanglement',
  blurb: 'States that cannot be written as a product — the resource that makes quantum different.',
  estMinutes: 30,
  sections: [
    { id: 'separable', title: 'Separable vs Entangled States' },
    { id: 'bell-states', title: 'The Bell States' },
    { id: 'reduced-density', title: 'Reduced Density Matrices', summary: 'Why an entangled qubit’s Bloch arrow shrinks.' },
    { id: 'no-signalling', title: 'No Faster-Than-Light Signalling' },
    { id: 'ghz', title: 'GHZ and Multipartite Entanglement' },
  ],
}

const measurement: Topic = {
  slug: 'measurement',
  title: 'Measurement',
  blurb: 'The Born rule, collapse, and what a shot histogram is actually telling you.',
  estMinutes: 25,
  sections: [
    { id: 'born-rule', title: 'The Born Rule' },
    { id: 'collapse', title: 'Collapse' },
    { id: 'bases', title: 'Measuring in Other Bases' },
    { id: 'repeated', title: 'Repeated Measurement and Shots' },
    { id: 'expectation', title: 'Expectation Values' },
  ],
}

export const THEORY_TOPICS: Topic[] = [
  diracNotation,
  qubitsBloch,
  gates,
  tensorProducts,
  entanglement,
  measurement,
]
