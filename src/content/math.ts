/**
 * MATHS TRACK — placeholder content.
 *
 * Everything here is a stub: titles, ordering and section counts are all yours to change.
 * To add a section, add an object to `sections`. To reorder, move the line. To write content,
 * replace the section's `status: 'placeholder'` with a `blocks: [...]` array (see types.ts for the
 * block vocabulary — text with $LaTeX$, math, list, callout, widget).
 *
 * `complex-numbers` below has one worked section filled in as a demonstration of every block type.
 * Delete or rewrite it freely.
 */

import type { Topic } from './types'

const complexNumbers: Topic = {
  slug: 'complex-numbers',
  title: 'Complex Numbers',
  blurb: 'The number system quantum amplitudes live in — and why phase is the point.',
  estMinutes: 25,
  sections: [
    {
      id: 'why-complex',
      title: 'Why Quantum Mechanics Needs Complex Numbers',
      summary: 'Interference requires a quantity that can cancel as well as add.',
      // ↓ A fully worked example section, showing every block type available to you.
      status: 'draft',
      blocks: [
        {
          kind: 'text',
          text: 'A classical probability is a non-negative real number, and probabilities only ever add up. Quantum mechanics instead assigns each outcome a complex **amplitude** $\\alpha$, and the probability is recovered as $|\\alpha|^2$.',
        },
        {
          kind: 'text',
          text: 'That squaring step is what makes room for interference: two amplitudes of equal size can cancel completely if their phases are opposite.',
        },
        { kind: 'math', tex: '\\tfrac{1}{\\sqrt2} + \\left(-\\tfrac{1}{\\sqrt2}\\right) = 0', caption: 'Destructive interference — impossible with classical probabilities.' },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'The one-sentence version',
          text: 'Phase is invisible to a single measurement but decides everything about how amplitudes combine.',
        },
        { kind: 'widget', widget: 'argand-plane', caption: 'Drag the point to see modulus and argument change.' },
        {
          kind: 'list',
          items: [
            'A complex number $z = a + bi$ has modulus $|z| = \\sqrt{a^2+b^2}$.',
            'Its argument $\\arg(z)$ is the angle it makes with the positive real axis.',
            'In polar form $z = re^{i\\theta}$, multiplication adds angles and multiplies lengths.',
          ],
        },
      ],
    },
    { id: 'arithmetic', title: 'Arithmetic: Add, Multiply, Divide', summary: 'The mechanics, briefly.' },
    { id: 'conjugate-modulus', title: 'Conjugate and Modulus', summary: 'Where $|\\alpha|^2$ comes from.' },
    { id: 'polar-form', title: 'Polar Form and Euler’s Formula', summary: '$e^{i\\theta} = \\cos\\theta + i\\sin\\theta$.' },
    { id: 'roots-of-unity', title: 'Roots of Unity', summary: 'The backbone of the quantum Fourier transform.' },
  ],
}

const vectorsMatrices: Topic = {
  slug: 'vectors-and-matrices',
  title: 'Vectors & Matrices',
  blurb: 'Linear algebra as the language of quantum states and operations.',
  estMinutes: 35,
  sections: [
    { id: 'vectors', title: 'Complex Vectors', summary: 'Column vectors with complex entries.' },
    { id: 'inner-product', title: 'Inner Products and Norms' },
    { id: 'matrices', title: 'Matrices as Transformations' },
    { id: 'multiplication', title: 'Matrix Multiplication' },
    { id: 'adjoint', title: 'Transpose, Conjugate, Adjoint' },
    { id: 'unitary', title: 'Unitary Matrices', summary: 'Why every quantum gate must satisfy $U^\\dagger U = I$.' },
    { id: 'hermitian', title: 'Hermitian Matrices and Observables' },
  ],
}

const eigen: Topic = {
  slug: 'eigenvalues-and-eigenvectors',
  title: 'Eigenvalues & Eigenvectors',
  blurb: 'The directions an operator leaves alone — and what they mean physically.',
  estMinutes: 25,
  sections: [
    { id: 'definition', title: 'The Eigenvalue Equation' },
    { id: 'finding', title: 'Finding Eigenvalues' },
    { id: 'pauli-eigen', title: 'Eigenvectors of the Pauli Matrices' },
    { id: 'spectral', title: 'Spectral Decomposition' },
    { id: 'measurement-link', title: 'Connection to Measurement' },
  ],
}

const probability: Topic = {
  slug: 'probability',
  title: 'Probability Basics',
  blurb: 'Just enough probability to read a quantum measurement result honestly.',
  estMinutes: 20,
  sections: [
    { id: 'distributions', title: 'Distributions and Expectation' },
    { id: 'sampling', title: 'Sampling and Shot Noise', summary: 'Why 1000 shots does not give you exact probabilities.' },
    { id: 'conditional', title: 'Conditional Probability' },
    { id: 'born-rule', title: 'The Born Rule' },
  ],
}

export const MATH_TOPICS: Topic[] = [complexNumbers, vectorsMatrices, eigen, probability]
