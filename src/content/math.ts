/**
 * MATHS TRACK.
 *
 * The groundwork the theory track leans on: complex numbers (where amplitudes live), linear
 * algebra (where states and gates live), eigenvectors (where measurement outcomes come from),
 * and enough probability to read a result honestly.
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
    {
      id: 'arithmetic',
      title: 'Arithmetic: Add, Multiply, Divide',
      summary: 'The mechanics, briefly.',
      blocks: [
        {
          kind: 'text',
          text: 'Treat $i$ as an ordinary symbol obeying one extra rule, $i^2 = -1$, and everything else follows from normal algebra.',
        },
        { kind: 'math', tex: '(a+bi) + (c+di) = (a+c) + (b+d)i' },
        { kind: 'math', tex: '(a+bi)(c+di) = (ac - bd) + (ad + bc)i' },
        {
          kind: 'text',
          text: 'Addition is componentwise, exactly like adding vectors in the plane. Multiplication is the interesting one — the $-bd$ term comes from $i^2 = -1$, and it is what makes multiplication a **rotation** rather than just a scaling.',
        },
        {
          kind: 'text',
          text: 'Division is done by making the denominator real. Multiply top and bottom by the conjugate of the denominator:',
        },
        { kind: 'math', tex: '\\frac{1}{c+di} = \\frac{c-di}{(c+di)(c-di)} = \\frac{c-di}{c^2+d^2}' },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Worth checking by hand',
          text: 'Verify that $(1+i)(1-i) = 2$ and that $1/i = -i$. Both come up constantly, and both are easy to get wrong the first few times.',
        },
      ],
    },
    {
      id: 'conjugate-modulus',
      title: 'Conjugate and Modulus',
      summary: 'Where $|\\alpha|^2$ comes from.',
      blocks: [
        {
          kind: 'text',
          text: 'The **conjugate** flips the sign of the imaginary part: $\\overline{a+bi} = a-bi$. Geometrically it is a reflection in the real axis.',
        },
        {
          kind: 'text',
          text: 'Multiplying a number by its own conjugate always gives a non-negative real number — the squared modulus:',
        },
        { kind: 'math', tex: 'z\\bar z = (a+bi)(a-bi) = a^2 + b^2 = |z|^2' },
        {
          kind: 'text',
          text: 'This is exactly the Born rule’s machinery. An amplitude $\\alpha$ may be complex, but $|\\alpha|^2 = \\alpha\\bar\\alpha$ is guaranteed real and non-negative — which is the minimum requirement for calling something a probability.',
        },
        {
          kind: 'text',
          text: 'It also explains why **global phase is unobservable**. Multiply a state by $e^{i\\gamma}$ and every probability is unchanged, because',
        },
        { kind: 'math', tex: '|e^{i\\gamma}\\alpha|^2 = e^{i\\gamma}\\alpha \\cdot \\overline{e^{i\\gamma}\\alpha} = e^{i\\gamma}e^{-i\\gamma}\\alpha\\bar\\alpha = |\\alpha|^2' },
        { kind: 'exercise', id: 'amplitude-to-probability' },
      ],
    },
    {
      id: 'polar-form',
      title: 'Polar Form and Euler’s Formula',
      summary: '$e^{i\\theta} = \\cos\\theta + i\\sin\\theta$.',
      blocks: [
        {
          kind: 'text',
          text: 'Any complex number can be written by its length and angle instead of its components:',
        },
        { kind: 'math', tex: 'z = r e^{i\\theta}, \\qquad r = |z|, \\quad \\theta = \\arg(z)' },
        {
          kind: 'text',
          text: 'Euler’s formula is what connects the two descriptions:',
        },
        { kind: 'math', tex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta' },
        {
          kind: 'text',
          text: 'Polar form makes multiplication obvious — lengths multiply, angles add:',
        },
        { kind: 'math', tex: 'r_1e^{i\\theta_1} \\cdot r_2e^{i\\theta_2} = r_1r_2\\,e^{i(\\theta_1+\\theta_2)}' },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Why every phase gate looks like this',
          text: 'The $T$ gate multiplies $|1\\rangle$ by $e^{i\\pi/4}$ — an eighth of a turn, no change in length. $S$ is $e^{i\\pi/2}$, a quarter turn. $Z$ is $e^{i\\pi} = -1$, a half turn. All of them are rotations in the complex plane, which is exactly why they are rotations about the $z$-axis of the Bloch sphere.',
        },
      ],
    },
    {
      id: 'roots-of-unity',
      title: 'Roots of Unity',
      summary: 'The backbone of the quantum Fourier transform.',
      blocks: [
        {
          kind: 'text',
          text: 'The $N$th roots of unity are the $N$ solutions of $z^N = 1$. They sit evenly spaced around the unit circle:',
        },
        { kind: 'math', tex: '\\omega_N^k = e^{2\\pi i k/N}, \\qquad k = 0, 1, \\ldots, N-1' },
        {
          kind: 'text',
          text: 'For $N = 4$ they are $1,\\, i,\\, -1,\\, -i$ — a quarter turn apart. For $N = 8$ they are eighth-turns, which is where the $T$ gate’s $e^{i\\pi/4}$ comes from.',
        },
        {
          kind: 'text',
          text: 'Their crucial property is that they **sum to zero** whenever $k \\neq 0$:',
        },
        { kind: 'math', tex: '\\sum_{j=0}^{N-1} \\omega_N^{jk} = 0 \\quad\\text{unless } k \\equiv 0' },
        {
          kind: 'text',
          text: 'Evenly spaced vectors around a circle cancel exactly. That cancellation is the entire mechanism of the Fourier transform — and in the quantum case, it is what makes wrong answers destructively interfere while the right one survives.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Where you will meet these again',
          text: 'The QFT is built from exactly these numbers: $|j\\rangle \\mapsto \\frac{1}{\\sqrt N}\\sum_k \\omega_N^{jk}|k\\rangle$. Everything it does is roots of unity being added up.',
        },
      ],
    },
  ],
}

const vectorsMatrices: Topic = {
  slug: 'vectors-and-matrices',
  title: 'Vectors & Matrices',
  blurb: 'Linear algebra as the language of quantum states and operations.',
  estMinutes: 35,
  sections: [
    {
      id: 'vectors',
      title: 'Complex Vectors',
      summary: 'Column vectors with complex entries.',
      blocks: [
        {
          kind: 'text',
          text: 'A quantum state of $n$ qubits is a column vector of $2^n$ complex numbers. For one qubit that is just two entries:',
        },
        { kind: 'math', tex: '|\\psi\\rangle = \\begin{pmatrix} \\alpha \\\\ \\beta \\end{pmatrix} = \\alpha\\begin{pmatrix} 1 \\\\ 0 \\end{pmatrix} + \\beta\\begin{pmatrix} 0 \\\\ 1 \\end{pmatrix}' },
        {
          kind: 'text',
          text: 'Vectors add componentwise and scale by multiplying every entry. That is all **linearity** means, and it is the single most important structural fact about quantum mechanics: everything a gate does is determined by what it does to basis vectors.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'The entries are complex, and that matters',
          text: 'Everything here would work with real numbers too — except interference. Complex entries are what let two contributions cancel by phase rather than only by sign.',
        },
      ],
    },
    {
      id: 'inner-product',
      title: 'Inner Products and Norms',
      blocks: [
        {
          kind: 'text',
          text: 'The inner product of two complex vectors **conjugates the first one**:',
        },
        { kind: 'math', tex: '\\langle\\phi|\\psi\\rangle = \\sum_i \\overline{\\phi_i}\\,\\psi_i' },
        {
          kind: 'text',
          text: 'The conjugation is not cosmetic. Without it, $\\langle\\psi|\\psi\\rangle$ could be complex or negative, and there would be no sensible notion of length. With it, the norm is always real and non-negative:',
        },
        { kind: 'math', tex: '\\|\\psi\\| = \\sqrt{\\langle\\psi|\\psi\\rangle} = \\sqrt{\\textstyle\\sum_i |\\psi_i|^2}' },
        {
          kind: 'text',
          text: 'Two vectors are **orthogonal** when their inner product is zero. Orthogonal states are perfectly distinguishable by measurement — which is exactly why a measurement basis must be an orthonormal set.',
        },
      ],
    },
    {
      id: 'matrices',
      title: 'Matrices as Transformations',
      blocks: [
        {
          kind: 'text',
          text: 'A matrix is a linear map: feed it a vector, get a vector. Because it is linear, knowing where it sends each basis vector tells you everything — the columns of the matrix **are** the images of the basis vectors.',
        },
        { kind: 'math', tex: 'X = \\begin{pmatrix} 0&1 \\\\ 1&0 \\end{pmatrix} \\quad\\text{sends}\\quad \\begin{pmatrix}1\\\\0\\end{pmatrix} \\mapsto \\begin{pmatrix}0\\\\1\\end{pmatrix}' },
        {
          kind: 'text',
          text: 'Read the first column: it is where $|0\\rangle$ goes. The second column is where $|1\\rangle$ goes. Once you start reading matrices this way, most gate matrices become obvious at a glance.',
        },
        { kind: 'widget', widget: 'matrix-playground', caption: 'Each gate’s matrix alongside what it does.' },
      ],
    },
    {
      id: 'multiplication',
      title: 'Matrix Multiplication',
      blocks: [
        {
          kind: 'text',
          text: 'Multiplying matrices composes their transformations. The entry in row $i$, column $j$ of $AB$ is the inner-product-like sum',
        },
        { kind: 'math', tex: '(AB)_{ij} = \\sum_k A_{ik}B_{kj}' },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Order matters, and it is backwards from the circuit',
          text: 'A circuit reads left to right, but the matrix product is written right to left. Applying $A$ then $B$ is the matrix $BA$. Getting this backwards is one of the most common early mistakes.',
        },
        {
          kind: 'text',
          text: 'Matrices generally do **not** commute: $XZ \\neq ZX$. For the Pauli gates they anticommute, $XZ = -ZX$, and that failure to commute is the algebraic source of the uncertainty principle.',
        },
      ],
    },
    {
      id: 'adjoint',
      title: 'Transpose, Conjugate, Adjoint',
      blocks: [
        {
          kind: 'text',
          text: 'The **adjoint** (or dagger) is the conjugate transpose — flip across the diagonal and conjugate every entry:',
        },
        { kind: 'math', tex: '(A^\\dagger)_{ij} = \\overline{A_{ji}}' },
        {
          kind: 'text',
          text: 'For real matrices this is just the transpose. For complex ones the conjugation is essential, for the same reason it is essential in the inner product.',
        },
        {
          kind: 'text',
          text: 'Two identities are worth memorising, because both reverse the order:',
        },
        { kind: 'math', tex: '(AB)^\\dagger = B^\\dagger A^\\dagger, \\qquad (A^\\dagger)^\\dagger = A' },
        {
          kind: 'text',
          text: 'The first is why reversing a circuit means applying each gate’s inverse **in reverse order** — which is exactly how the inverse QFT in the phase-estimation circuit is built.',
        },
      ],
    },
    {
      id: 'unitary',
      title: 'Unitary Matrices',
      summary: 'Why every quantum gate must satisfy $U^\\dagger U = I$.',
      blocks: [
        {
          kind: 'text',
          text: 'A matrix is **unitary** when its adjoint is its inverse:',
        },
        { kind: 'math', tex: 'U^\\dagger U = U U^\\dagger = I' },
        {
          kind: 'text',
          text: 'Equivalently: $U$ preserves inner products, and therefore lengths and angles. It rotates the state space without stretching it. Since a state’s length encodes total probability, this is precisely the condition that probability is conserved.',
        },
        {
          kind: 'list',
          items: [
            'Every unitary is invertible, so **every quantum gate is reversible**.',
            'The columns of a unitary form an orthonormal set — a useful way to check one by eye.',
            'Every eigenvalue of a unitary has modulus 1, so it can be written $e^{i\\theta}$ — a pure phase.',
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Check it in the Circuit Lab',
          text: 'The custom gate dialog runs exactly this test on whatever matrix you type, and reports how far $U^\\dagger U$ strays from the identity. Try a matrix that is nearly unitary and watch the deviation.',
        },
      ],
    },
    {
      id: 'hermitian',
      title: 'Hermitian Matrices and Observables',
      blocks: [
        {
          kind: 'text',
          text: 'A matrix is **Hermitian** when it equals its own adjoint, $A = A^\\dagger$. Hermitian and unitary are different conditions and serve different roles:',
        },
        {
          kind: 'list',
          items: [
            '**Unitary** matrices are the things you *do* — gates, evolution.',
            '**Hermitian** matrices are the things you *measure* — observables.',
          ],
        },
        {
          kind: 'text',
          text: 'The reason observables must be Hermitian is that Hermitian matrices have **real eigenvalues**, and measurement outcomes are real numbers. The three Pauli matrices are all Hermitian, with eigenvalues $\\pm 1$ — which is why measuring them gives $\\pm 1$.',
        },
        {
          kind: 'text',
          text: 'The two families are linked by exponentiation: for any Hermitian $H$, the matrix $e^{-iHt}$ is unitary. That is the Schrödinger equation in one line, and it is why the rotation gates are written $R_k(\\theta) = e^{-i\\theta\\sigma_k/2}$.',
        },
      ],
    },
  ],
}

const eigen: Topic = {
  slug: 'eigenvalues-and-eigenvectors',
  title: 'Eigenvalues & Eigenvectors',
  blurb: 'The directions an operator leaves alone — and what they mean physically.',
  estMinutes: 25,
  sections: [
    {
      id: 'definition',
      title: 'The Eigenvalue Equation',
      blocks: [
        {
          kind: 'text',
          text: 'Most vectors get rotated by a matrix. A few special ones only get **scaled** — they keep pointing the same way. Those are the eigenvectors, and the scale factor is the eigenvalue:',
        },
        { kind: 'math', tex: 'A|v\\rangle = \\lambda|v\\rangle' },
        {
          kind: 'text',
          text: 'Eigenvectors are the natural coordinate system for an operator. Written in its own eigenbasis, a matrix becomes diagonal, and a complicated transformation turns into "scale each axis independently".',
        },
      ],
    },
    {
      id: 'finding',
      title: 'Finding Eigenvalues',
      blocks: [
        {
          kind: 'text',
          text: 'Rearrange the eigenvalue equation to $(A - \\lambda I)|v\\rangle = 0$. A non-zero solution exists only when the matrix is singular, so:',
        },
        { kind: 'math', tex: '\\det(A - \\lambda I) = 0' },
        {
          kind: 'text',
          text: 'For a $2 \\times 2$ matrix this is a quadratic — the **characteristic polynomial**. Solve it for $\\lambda$, then substitute each root back to find the corresponding eigenvector.',
        },
        {
          kind: 'text',
          text: 'Worked example with $Z$:',
        },
        { kind: 'math', tex: '\\det\\begin{pmatrix} 1-\\lambda & 0 \\\\ 0 & -1-\\lambda \\end{pmatrix} = (1-\\lambda)(-1-\\lambda) = 0' },
        {
          kind: 'text',
          text: 'giving $\\lambda = \\pm 1$, with eigenvectors $|0\\rangle$ and $|1\\rangle$. A diagonal matrix always has its eigenvalues sitting on the diagonal and the basis vectors as eigenvectors.',
        },
      ],
    },
    {
      id: 'pauli-eigen',
      title: 'Eigenvectors of the Pauli Matrices',
      blocks: [
        {
          kind: 'text',
          text: 'Each Pauli matrix has eigenvalues $\\pm 1$, and its eigenvectors are exactly the two poles of its axis on the Bloch sphere:',
        },
        {
          kind: 'list',
          items: [
            '$Z$: eigenvectors $|0\\rangle$ and $|1\\rangle$ — the $z$-axis poles.',
            '$X$: eigenvectors $|+\\rangle$ and $|-\\rangle$ — the $x$-axis poles.',
            '$Y$: eigenvectors $|i\\rangle$ and $|-i\\rangle$ — the $y$-axis poles.',
          ],
        },
        {
          kind: 'text',
          text: 'This is not a coincidence — it is the whole reason the Bloch sphere has the axes it has. The six cardinal states of the sphere are precisely the six Pauli eigenvectors, and all six are available as inputs in the Circuit Lab.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Eigenvector means "unchanged by"',
          text: 'Applying $Z$ to $|0\\rangle$ does nothing at all. Applying it to $|+\\rangle$ flips it to $|-\\rangle$. A gate is invisible to its own eigenvectors — up to phase — and maximally disruptive to the eigenvectors of the operators it anticommutes with.',
        },
      ],
    },
    {
      id: 'spectral',
      title: 'Spectral Decomposition',
      blocks: [
        {
          kind: 'text',
          text: 'Any Hermitian matrix can be rebuilt entirely from its eigenvalues and eigenvectors:',
        },
        { kind: 'math', tex: 'A = \\sum_i \\lambda_i\\,|v_i\\rangle\\langle v_i|' },
        {
          kind: 'text',
          text: 'Each term is an eigenvalue times a projector onto its eigenvector. For $Z$ this reads $Z = (+1)|0\\rangle\\langle 0| + (-1)|1\\rangle\\langle 1|$ — literally "give $|0\\rangle$ the value $+1$ and $|1\\rangle$ the value $-1$".',
        },
        {
          kind: 'text',
          text: 'The decomposition also makes functions of matrices easy: apply the function to the eigenvalues and leave the projectors alone. That is how $e^{-iHt}$ is actually computed, and why phase gates are so simple — they are diagonal already.',
        },
      ],
    },
    {
      id: 'measurement-link',
      title: 'Connection to Measurement',
      blocks: [
        {
          kind: 'text',
          text: 'This is where the linear algebra becomes physics. Measuring an observable $A$:',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            'The possible **outcomes** are the eigenvalues of $A$ — which is why $A$ must be Hermitian, so they are real.',
            'The **probability** of outcome $\\lambda_i$ is $|\\langle v_i|\\psi\\rangle|^2$, the squared overlap with that eigenvector.',
            'After the measurement the state **collapses** onto $|v_i\\rangle$.',
          ],
        },
        {
          kind: 'text',
          text: 'Measuring in the computational basis is measuring $Z$. The outcomes $\\pm 1$ are relabelled 0 and 1, and the probabilities $|\\langle 0|\\psi\\rangle|^2$ and $|\\langle 1|\\psi\\rangle|^2$ are exactly $|\\alpha|^2$ and $|\\beta|^2$.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Expectation values without tomography',
          text: 'The average of an observable is $\\langle A\\rangle = \\langle\\psi|A|\\psi\\rangle$, which for $Z$ equals $P(0) - P(1)$ — the $z$-coordinate on the Bloch sphere. You can estimate it by averaging $\\pm1$ over your shots, without ever reconstructing the full state.',
        },
      ],
    },
  ],
}

const probability: Topic = {
  slug: 'probability',
  title: 'Probability Basics',
  blurb: 'Just enough probability to read a quantum measurement result honestly.',
  estMinutes: 20,
  sections: [
    {
      id: 'distributions',
      title: 'Distributions and Expectation',
      blocks: [
        {
          kind: 'text',
          text: 'A distribution assigns a probability to each outcome, with everything non-negative and summing to 1. A quantum circuit produces exactly this over bitstrings — the **Probabilities** tab in the Circuit Lab is a distribution over the $2^n$ basis states.',
        },
        {
          kind: 'text',
          text: 'The expectation value is the probability-weighted average:',
        },
        { kind: 'math', tex: '\\mathbb{E}[X] = \\sum_i p_i\\,x_i' },
        {
          kind: 'text',
          text: 'Variance $\\mathbb{E}[X^2] - \\mathbb{E}[X]^2$ measures spread. Both carry straight over to quantum measurements, where the outcomes $x_i$ are an observable’s eigenvalues.',
        },
      ],
    },
    {
      id: 'sampling',
      title: 'Sampling and Shot Noise',
      summary: 'Why 1000 shots does not give you exact probabilities.',
      blocks: [
        {
          kind: 'text',
          text: 'You never observe a probability — you observe counts. Estimating $p$ from $N$ independent shots gives an estimate whose standard error is',
        },
        { kind: 'math', tex: '\\sigma = \\sqrt{\\frac{p(1-p)}{N}}' },
        {
          kind: 'text',
          text: 'The $\\sqrt N$ is unforgiving: **to halve your error you need four times the shots.** For a true 50/50 split:',
        },
        {
          kind: 'list',
          items: [
            '100 shots — standard error 5%, so results between 40/60 and 60/40 are routine.',
            '1,000 shots — about 1.6%.',
            '10,000 shots — about 0.5%.',
            '1,000,000 shots — about 0.05%.',
          ],
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Do not over-read a histogram',
          text: 'A 47/53 split from 100 shots is entirely consistent with a fair coin. Before concluding a circuit is biased, check whether the deviation exceeds a couple of standard errors.',
        },
        { kind: 'circuit', preset: 'qrng', caption: 'Run this at 100 shots several times, then at 8192, and watch the spread of results tighten.' },
      ],
    },
    {
      id: 'conditional',
      title: 'Conditional Probability',
      blocks: [
        {
          kind: 'text',
          text: 'The probability of $A$ **given** that $B$ happened:',
        },
        { kind: 'math', tex: 'P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}' },
        {
          kind: 'text',
          text: 'Events are **independent** when $P(A \\mid B) = P(A)$ — learning $B$ tells you nothing about $A$. Measuring the two qubits of a product state gives independent results; measuring a Bell pair does not.',
        },
        {
          kind: 'text',
          text: 'The division by $P(B)$ is renormalisation: having ruled out everything where $B$ failed, the surviving probabilities must be rescaled to sum to 1 again. Quantum collapse does exactly the same thing to amplitudes, dividing by $\\sqrt{P(\\text{outcome})}$.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Correlation is not signalling',
          text: 'Measuring one half of a Bell pair makes the other perfectly predictable — the conditional probability jumps to 1. But the **marginal** distribution on the far qubit is 50/50 either way, which is why no information is transmitted.',
        },
      ],
    },
    {
      id: 'born-rule',
      title: 'The Born Rule',
      blocks: [
        {
          kind: 'text',
          text: 'The bridge from amplitudes to the probabilities above:',
        },
        { kind: 'math', tex: 'P(i) = |\\langle i|\\psi\\rangle|^2' },
        {
          kind: 'text',
          text: 'Normalisation guarantees these sum to 1, so the rule really does produce a distribution. But the squaring makes quantum probability behave unlike the classical kind in one decisive way.',
        },
        {
          kind: 'text',
          text: 'Classically, the probability of reaching an outcome by either of two routes is $p_1 + p_2$ — always at least as large as each. Quantum mechanically you add **amplitudes first** and square afterwards:',
        },
        { kind: 'math', tex: 'P = |\\alpha_1 + \\alpha_2|^2 \;\\neq\; |\\alpha_1|^2 + |\\alpha_2|^2' },
        {
          kind: 'text',
          text: 'The cross term is interference. Two routes can cancel to zero probability, which no classical mixture can do. Every quantum speedup in the Algorithms track comes from arranging that cancellation on the wrong answers.',
        },
      ],
    },
  ],
}

export const MATH_TOPICS: Topic[] = [complexNumbers, vectorsMatrices, eigen, probability]
