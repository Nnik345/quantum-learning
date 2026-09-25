/**
 * THEORY TRACK.
 *
 * Ordered so nothing forward-references: notation, then the single qubit, then what gates do to
 * it, then how qubits combine, then what combining makes possible, then what measurement takes
 * away. Sections carry worked circuits where a claim is checkable in the Circuit Lab.
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
    {
      id: 'bras',
      title: 'Bras and the Inner Product',
      summary: '$\\langle\\phi|\\psi\\rangle$ as overlap.',
      blocks: [
        {
          kind: 'text',
          text: 'A **bra** $\\langle\\phi|$ is the conjugate transpose of the ket $|\\phi\\rangle$ — a row vector whose entries are complex-conjugated. Put a bra next to a ket and the brackets close into a single number, the **inner product**:',
        },
        { kind: 'math', tex: '\\langle\\phi|\\psi\\rangle = \\sum_i \\overline{\\phi_i}\\,\\psi_i' },
        {
          kind: 'text',
          text: 'That number measures **overlap**: how much of $|\\psi\\rangle$ points along $|\\phi\\rangle$. It is 1 when the states are identical, 0 when they are orthogonal, and complex in between.',
        },
        {
          kind: 'list',
          items: [
            '$\\langle 0|0\\rangle = 1$ and $\\langle 1|1\\rangle = 1$ — every state fully overlaps itself.',
            '$\\langle 0|1\\rangle = 0$ — the computational basis states are orthogonal, which is what makes them perfectly distinguishable.',
            '$\\langle\\phi|\\psi\\rangle = \\overline{\\langle\\psi|\\phi\\rangle}$ — swapping the order conjugates the result.',
          ],
        },
        {
          kind: 'text',
          text: 'The Born rule is written in exactly this language: the probability of finding $|\\psi\\rangle$ in state $|\\phi\\rangle$ is $|\\langle\\phi|\\psi\\rangle|^2$. Amplitudes are overlaps, and probabilities are their squared magnitudes.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Where the names come from',
          text: 'Dirac called $\\langle \\cdot | \\cdot \\rangle$ a *bracket*, so the left half is a **bra** and the right half is a **ket**. The joke is old but the notation is genuinely good: it makes the algebra read like sentences.',
        },
      ],
    },
    {
      id: 'normalisation',
      title: 'Normalisation',
      blocks: [
        {
          kind: 'text',
          text: 'Probabilities must sum to 1, so every physical state satisfies $\\langle\\psi|\\psi\\rangle = 1$. For a single qubit that is exactly the familiar condition:',
        },
        { kind: 'math', tex: '\\langle\\psi|\\psi\\rangle = |\\alpha|^2 + |\\beta|^2 = 1' },
        {
          kind: 'text',
          text: 'A vector that is not normalised is not wrong so much as not yet a state — divide by its length $\\sqrt{\\langle\\psi|\\psi\\rangle}$ and it becomes one. The Circuit Lab enforces this: set a custom input state whose amplitudes do not square to 1, and it refuses the input and offers to normalise it for you.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'This is why gates must be unitary',
          text: 'If a gate could change $\\langle\\psi|\\psi\\rangle$, it would create or destroy probability. Preserving the inner product is precisely the condition $U^\\dagger U = I$.',
        },
      ],
    },
    {
      id: 'outer-products',
      title: 'Outer Products and Projectors',
      blocks: [
        {
          kind: 'text',
          text: 'Reverse the order — ket first, bra second — and instead of a number you get a **matrix**:',
        },
        { kind: 'math', tex: '|0\\rangle\\langle 0| = \\begin{pmatrix} 1 \\\\ 0 \\end{pmatrix}\\begin{pmatrix} 1 & 0 \\end{pmatrix} = \\begin{pmatrix} 1 & 0 \\\\ 0 & 0 \\end{pmatrix}' },
        {
          kind: 'text',
          text: 'This is a **projector**: it keeps the part of a state lying along $|0\\rangle$ and deletes the rest. Projectors are how measurement is written formally — measuring in the computational basis applies $|0\\rangle\\langle 0|$ or $|1\\rangle\\langle 1|$ and renormalises.',
        },
        {
          kind: 'text',
          text: 'Outer products also let you write any operator in a readable form. The Pauli-$X$ gate, for instance, is just "swap the two labels":',
        },
        { kind: 'math', tex: 'X = |0\\rangle\\langle 1| + |1\\rangle\\langle 0|' },
        {
          kind: 'text',
          text: 'Read it right to left: it takes anything that looks like $|1\\rangle$ and turns it into $|0\\rangle$, and vice versa. Compare that with reading the matrix $\\left(\\begin{smallmatrix}0&1\\\\1&0\\end{smallmatrix}\\right)$, and the appeal of the notation becomes obvious.',
        },
      ],
    },
    {
      id: 'basis-change',
      title: 'Changing Basis',
      summary: 'The same state seen in the $X$ basis.',
      blocks: [
        {
          kind: 'text',
          text: 'The computational basis $\\{|0\\rangle, |1\\rangle\\}$ has no special status. Any orthonormal pair works, and the most common alternative is the $X$ basis:',
        },
        { kind: 'math', tex: '|+\\rangle = \\tfrac{1}{\\sqrt2}(|0\\rangle + |1\\rangle), \\qquad |-\\rangle = \\tfrac{1}{\\sqrt2}(|0\\rangle - |1\\rangle)' },
        {
          kind: 'text',
          text: 'A state that is definite in one basis is maximally uncertain in the other. $|0\\rangle$ is certain in the computational basis, but expanding it in the $X$ basis gives $|0\\rangle = \\tfrac{1}{\\sqrt2}(|+\\rangle + |-\\rangle)$ — a coin flip.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Measuring in another basis',
          text: 'Hardware only measures in the computational basis. To measure in the $X$ basis you rotate the basis onto the computational one first — apply $H$, then measure. That single trick is how every other basis gets measured in practice.',
        },
        { kind: 'circuit', preset: 'qrng', caption: 'The $H$ here can be read two ways: preparing $|+\\rangle$ and measuring in the computational basis, or leaving $|0\\rangle$ alone and measuring in the $X$ basis. They are the same circuit.' },
      ],
    },
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
    {
      id: 'poles-and-equator',
      title: 'Poles, Equator, and the Six Cardinal States',
      blocks: [
        {
          kind: 'text',
          text: 'Six points come up constantly, one pair per axis. They are the eigenstates of the three Pauli operators:',
        },
        {
          kind: 'list',
          items: [
            '**$+z$ and $-z$:** $|0\\rangle$ and $|1\\rangle$ — the computational basis, at the poles.',
            '**$+x$ and $-x$:** $|+\\rangle$ and $|-\\rangle$ — equal superpositions with real amplitudes.',
            '**$+y$ and $-y$:** $|i\\rangle$ and $|-i\\rangle$ — equal superpositions with a quarter-turn phase.',
          ],
        },
        {
          kind: 'text',
          text: 'Note that **orthogonal states sit at opposite poles, not at right angles**. $|0\\rangle$ and $|1\\rangle$ are perpendicular as vectors, yet antipodal on the sphere. The half-angle $\\theta/2$ in the formula above is exactly what causes this: a 180° rotation on the sphere is a 90° rotation in state space.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Try it',
          text: 'All six are available as circuit inputs. Click the ket button in any wire’s gutter in the Circuit Lab and pick one, then look at the **Bloch** tab to see where it lands.',
        },
      ],
    },
    {
      id: 'global-phase',
      title: 'Global vs Relative Phase',
      summary: 'One is invisible, one is everything.',
      blocks: [
        {
          kind: 'text',
          text: 'Multiply an entire state by a phase and nothing observable changes:',
        },
        { kind: 'math', tex: '|\\psi\\rangle \\quad\\text{and}\\quad e^{i\\gamma}|\\psi\\rangle \\quad\\text{are the same physical state}' },
        {
          kind: 'text',
          text: 'Every probability is a squared magnitude, and $|e^{i\\gamma}\\alpha|^2 = |\\alpha|^2$. This **global phase** is unmeasurable, which is why the Bloch sphere can drop one of its four real parameters.',
        },
        {
          kind: 'text',
          text: 'A phase *between* the two amplitudes is a completely different matter:',
        },
        { kind: 'math', tex: '\\tfrac{1}{\\sqrt2}(|0\\rangle + |1\\rangle) \\quad\\text{vs}\\quad \\tfrac{1}{\\sqrt2}(|0\\rangle - |1\\rangle)' },
        {
          kind: 'text',
          text: 'Both give 50/50 in the computational basis, so they look identical if that is all you check. But they are $|+\\rangle$ and $|-\\rangle$ — antipodal, perfectly distinguishable states. Apply $H$ to each and one becomes $|0\\rangle$, the other $|1\\rangle$, with certainty.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'This distinction is the whole game',
          text: 'Quantum algorithms work by writing information into relative phases where a single query can reach all of them, then converting phase back into amplitude by interference. A global phase carries nothing; a relative phase carries everything.',
        },
      ],
    },
    {
      id: 'rotations',
      title: 'Gates as Rotations',
      blocks: [
        {
          kind: 'text',
          text: 'Every single-qubit gate is a rotation of the sphere. The Pauli gates are half-turns about their axes, and $H$ is a half-turn about the diagonal axis halfway between $x$ and $z$ — which is why it swaps the $x$ and $z$ poles, sending $|0\\rangle \\to |+\\rangle$ and $|+\\rangle \\to |0\\rangle$.',
        },
        {
          kind: 'text',
          text: 'The rotation gates make the angle explicit:',
        },
        { kind: 'math', tex: 'R_x(\\theta),\; R_y(\\theta),\; R_z(\\theta) \;=\; \\text{rotate by } \\theta \\text{ about } x,\\, y,\\, z' },
        {
          kind: 'text',
          text: 'Note the half-angles again: $R_z(\\pi)$ equals $Z$ only up to a global phase, because a full $2\\pi$ rotation of a qubit returns $-|\\psi\\rangle$, not $|\\psi\\rangle$. You need $4\\pi$ to truly return. That is not a quirk of the notation — it is a real property of spin-½ systems.',
        },
        { kind: 'widget', widget: 'matrix-playground', caption: 'The rotation matrices, with their half-angle structure visible.' },
      ],
    },
    {
      id: 'mixed-states',
      title: 'Inside the Sphere: Mixed States',
      blocks: [
        {
          kind: 'text',
          text: 'Points on the **surface** are pure states. Points **inside** are mixed — states about which you have incomplete information. The centre is maximal ignorance: a 50/50 coin flip with no phase information at all.',
        },
        {
          kind: 'text',
          text: 'A mixed state is described by a **density matrix** $\\rho$ rather than a vector, and its position in the ball is the vector $\\vec r$ with components $r_k = \\mathrm{Tr}(\\rho\\,\\sigma_k)$. The length $|\\vec r|$ measures purity: 1 on the surface, 0 at the centre.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Where mixed states come from here',
          text: 'The Circuit Lab never puts a mixed state in — every input is pure. Yet the Bloch arrows shrink all the time. That is because a qubit **entangled with another** has no pure state of its own; tracing out its partner leaves a mixed state. Entanglement, seen from one side, looks exactly like ignorance.',
        },
        { kind: 'circuit', preset: 'bell', caption: 'Open this and check the Bloch tab: two pure inputs, two maximally mixed outputs. Nothing was lost — the information moved into the correlation.' },
      ],
    },
  ],
}

const gates: Topic = {
  slug: 'quantum-gates',
  title: 'Quantum Gates',
  blurb: 'The unitary building blocks, what each one does, and why reversibility is forced.',
  estMinutes: 40,
  sections: [
    {
      id: 'unitarity',
      title: 'Why Gates Must Be Unitary',
      blocks: [
        {
          kind: 'text',
          text: 'Measurement probabilities are squared amplitudes, and they must sum to 1 both before and after a gate. A gate that changed the total would create or destroy probability outright.',
        },
        { kind: 'math', tex: '\\langle\\psi|U^\\dagger U|\\psi\\rangle = \\langle\\psi|\\psi\\rangle = 1 \\quad\\text{for every }|\\psi\\rangle \;\\Longrightarrow\; U^\\dagger U = I' },
        {
          kind: 'text',
          text: 'Two consequences follow immediately, and both are strange coming from classical computing:',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            '**Every gate is reversible.** $U^\\dagger$ undoes $U$. There is no quantum AND gate, because AND throws information away — you cannot recover its inputs from its output.',
            '**No gate can copy.** Cloning is not linear, and every gate is. This is the no-cloning theorem, and it falls straight out of unitarity.',
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Check it yourself',
          text: 'The Circuit Lab refuses a custom gate whose matrix fails $U^\\dagger U = I$, and reports how far off it is. Try entering $\\left(\\begin{smallmatrix}1&1\\\\1&1\\end{smallmatrix}\\right)$ and watch it be rejected.',
        },
      ],
    },
    {
      id: 'pauli',
      title: 'The Pauli Gates: X, Y, Z',
      blocks: [
        {
          kind: 'text',
          text: 'Three half-turns, one about each axis. They are the closest thing to "the basic operations" on a single qubit.',
        },
        { kind: 'math', tex: 'X = \\begin{pmatrix} 0&1 \\\\ 1&0 \\end{pmatrix}, \\quad Y = \\begin{pmatrix} 0&-i \\\\ i&0 \\end{pmatrix}, \\quad Z = \\begin{pmatrix} 1&0 \\\\ 0&-1 \\end{pmatrix}' },
        {
          kind: 'list',
          items: [
            '**$X$** is the bit flip — the quantum NOT. It swaps $|0\\rangle$ and $|1\\rangle$.',
            '**$Z$** is the phase flip. It leaves $|0\\rangle$ alone and negates $|1\\rangle$, which does nothing to probabilities but everything to interference.',
            '**$Y$** does both at once, up to a phase: $Y = iXZ$.',
          ],
        },
        {
          kind: 'text',
          text: 'Each squares to the identity, so each is its own inverse. They anticommute with one another — $XZ = -ZX$ — which is the algebraic root of the uncertainty relations.',
        },
      ],
    },
    {
      id: 'hadamard',
      title: 'The Hadamard Gate',
      blocks: [
        {
          kind: 'text',
          text: 'The single most important gate, because it is the bridge between the computational and $X$ bases:',
        },
        { kind: 'math', tex: 'H = \\tfrac{1}{\\sqrt2}\\begin{pmatrix} 1&1 \\\\ 1&-1 \\end{pmatrix}, \\qquad H|0\\rangle = |+\\rangle, \\quad H|1\\rangle = |-\\rangle' },
        {
          kind: 'text',
          text: 'Almost every algorithm opens with a layer of Hadamards, because $H^{\\otimes n}$ applied to $|00\\ldots0\\rangle$ produces an even superposition of **all** $2^n$ basis states at once — the "quantum parallelism" every popular account mentions.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Parallelism alone buys you nothing',
          text: 'Yes, the register now holds all $2^n$ inputs. But measuring returns exactly one of them, chosen at random — no better than guessing. The algorithm is whatever comes *between* the superposition and the measurement, arranging for wrong answers to cancel. Superposition is the setup, interference is the trick.',
        },
        {
          kind: 'text',
          text: '$H$ is also its own inverse, which is why the oracle algorithms sandwich the query between two layers of it: the first spreads out, the second brings back together.',
        },
        { kind: 'exercise', id: 'reach-minus' },
      ],
    },
    {
      id: 'phase-gates',
      title: 'Phase Gates: S and T',
      blocks: [
        {
          kind: 'text',
          text: 'These rotate about $z$ by a quarter and an eighth turn, adding phase to $|1\\rangle$ while leaving $|0\\rangle$ untouched:',
        },
        { kind: 'math', tex: 'S = \\begin{pmatrix} 1&0 \\\\ 0&i \\end{pmatrix} = \\sqrt{Z}, \\qquad T = \\begin{pmatrix} 1&0 \\\\ 0&e^{i\\pi/4} \\end{pmatrix} = \\sqrt{S}' },
        {
          kind: 'text',
          text: 'They change no probabilities on their own — a state measured immediately after a $T$ gate behaves exactly as before. Their effect only appears once a later Hadamard converts that phase into amplitude.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Why T is expensive',
          text: 'Clifford gates ($H$, $S$, CNOT and friends) are efficiently simulable classically — by the Gottesman–Knill theorem, a circuit built only from them gives no speedup at all. $T$ is what breaks out of that set, and in error-corrected hardware it is by far the costliest gate to implement. "T-count" is a real currency in circuit design.',
        },
      ],
    },
    {
      id: 'rotations',
      title: 'Rotation Gates: RX, RY, RZ',
      blocks: [
        {
          kind: 'text',
          text: 'Continuous rotations by any angle, generated by the corresponding Pauli:',
        },
        { kind: 'math', tex: 'R_k(\\theta) = e^{-i\\theta\\sigma_k/2} = \\cos\\tfrac{\\theta}{2}\\,I - i\\sin\\tfrac{\\theta}{2}\\,\\sigma_k' },
        {
          kind: 'text',
          text: '$R_z$ changes only phases, so it never moves probabilities. $R_y$ keeps all amplitudes real, which makes it the usual choice for preparing a state with a given probability split. $R_x$ sits between the two.',
        },
        {
          kind: 'text',
          text: 'These are the gates variational algorithms tune: the angles become the parameters a classical optimiser adjusts. In the Circuit Lab, place an $R_y$ and drag its angle slider while watching the Probabilities tab.',
        },
      ],
    },
    {
      id: 'cnot',
      title: 'CNOT and Controlled Gates',
      blocks: [
        {
          kind: 'text',
          text: 'A controlled gate applies its operation only on the part of the superposition where the control qubit is $|1\\rangle$. CNOT is the canonical example:',
        },
        { kind: 'math', tex: '\\mathrm{CNOT}\\,|c, t\\rangle = |c,\; t \\oplus c\\rangle' },
        {
          kind: 'text',
          text: 'On basis states it is unremarkable — a classical conditional flip. On a **superposed** control it is transformative: it does not pick a branch, it acts on both, and the register comes out entangled. That is precisely the Bell circuit.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Control is not a direction',
          text: 'Drawing the dot on the top wire is a convention, not a physical fact. Conjugating a CNOT with Hadamards on both wires exchanges control and target exactly. $CZ$ makes this obvious — it is symmetric, so the diagram uses two identical dots.',
        },
        { kind: 'circuit', preset: 'bell', caption: 'A CNOT with a superposed control. The output cannot be factored into a state for q0 times a state for q1.' },
      ],
    },
    {
      id: 'toffoli',
      title: 'Toffoli and Multi-Control',
      blocks: [
        {
          kind: 'text',
          text: 'Add a second control and you get the Toffoli gate, CCX, which flips its target only when **both** controls are $|1\\rangle$. It computes AND into the target, reversibly:',
        },
        { kind: 'math', tex: '|a, b, c\\rangle \;\\longmapsto\; |a,\\, b,\\, c \\oplus (a \\wedge b)\\rangle' },
        {
          kind: 'text',
          text: 'Toffoli is **universal for classical reversible computation** — anything a classical computer can do, a circuit of Toffolis can do. Keeping the inputs around is what makes it reversible, and it is why quantum circuits accumulate ancilla qubits holding intermediate results.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Multi-control is not free',
          text: 'A Toffoli is drawn as one symbol but is not one operation on hardware. Decomposing it into one- and two-qubit gates costs six CNOTs and several $T$ gates. Circuits that look cheap on paper can be expensive in practice.',
        },
      ],
    },
    {
      id: 'universality',
      title: 'Universal Gate Sets',
      blocks: [
        {
          kind: 'text',
          text: 'You do not need every gate. A small set suffices to approximate any unitary to arbitrary precision — for example $\\{H, T, \\mathrm{CNOT}\\}$.',
        },
        {
          kind: 'text',
          text: 'The **Solovay–Kitaev theorem** makes this practical: any single-qubit unitary can be approximated to accuracy $\\varepsilon$ using only $O(\\log^c(1/\\varepsilon))$ gates from such a set. The overhead is polylogarithmic, not exponential, so compiling an idealised circuit down to real hardware gates is tractable.',
        },
        {
          kind: 'list',
          items: [
            'Entangling power must come from somewhere — a set of single-qubit gates alone can never be universal.',
            'Clifford gates alone are not enough either; they are classically simulable. $T$ (or any non-Clifford) is essential.',
            'Different hardware exposes different native sets, and the compiler’s job is translating between them.',
          ],
        },
      ],
    },
  ],
}

const tensorProducts: Topic = {
  slug: 'tensor-products',
  title: 'Tensor Products',
  blurb: 'How two qubits combine into one four-dimensional state — and why that grows so fast.',
  estMinutes: 30,
  sections: [
    {
      id: 'motivation',
      title: 'Combining Two Systems',
      blocks: [
        {
          kind: 'text',
          text: 'Two classical bits give you four possible values, and you describe them with two bits of storage. Two qubits also have four basis states — but you need **four amplitudes**, one per basis state, not two.',
        },
        { kind: 'math', tex: '|\\psi\\rangle = \\alpha_{00}|00\\rangle + \\alpha_{01}|01\\rangle + \\alpha_{10}|10\\rangle + \\alpha_{11}|11\\rangle' },
        {
          kind: 'text',
          text: 'Classical systems combine by *listing* their parts; quantum systems combine by taking a **tensor product**, and the dimensions multiply rather than add. This single fact is the source of both quantum computing’s power and the difficulty of simulating it.',
        },
      ],
    },
    {
      id: 'kronecker',
      title: 'The Kronecker Product',
      blocks: [
        {
          kind: 'text',
          text: 'Concretely, $\\otimes$ multiplies every entry of the first vector by the whole of the second:',
        },
        { kind: 'math', tex: '\\begin{pmatrix} a \\\\ b \\end{pmatrix} \\otimes \\begin{pmatrix} c \\\\ d \\end{pmatrix} = \\begin{pmatrix} ac \\\\ ad \\\\ bc \\\\ bd \\end{pmatrix}' },
        {
          kind: 'text',
          text: 'The same rule applies to operators. A gate acting on only one qubit of a pair is really $U \\otimes I$ or $I \\otimes U$ — it acts on its own qubit and leaves the other alone, but formally it is still a $4 \\times 4$ matrix.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'How this simulator does it',
          text: 'Building the full $2^n \\times 2^n$ matrix would be ruinous. Instead the simulator applies a small gate matrix directly to the affected amplitudes, leaving the rest untouched — the same result, without ever materialising the tensor product.',
        },
      ],
    },
    {
      id: 'notation',
      title: 'Notation: $|0\\rangle \\otimes |1\\rangle = |01\\rangle$',
      blocks: [
        {
          kind: 'text',
          text: 'Writing $\\otimes$ everywhere gets tiring, so the symbols are simply concatenated inside one ket. All of these mean the same thing:',
        },
        { kind: 'math', tex: '|0\\rangle \\otimes |1\\rangle \;=\; |0\\rangle|1\\rangle \;=\; |01\\rangle' },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Ordering bites people constantly',
          text: 'On this site $q_0$ is the top wire and the **leftmost** symbol, so $|01\\rangle$ means $q_0 = 0,\; q_1 = 1$. Qiskit writes the same state as `10`, because it puts $q_0$ last. Neither is wrong, but mixing them silently produces mirrored bitstrings and hours of confusion.',
        },
      ],
    },
    {
      id: 'gates-on-registers',
      title: 'Applying a Gate to One Qubit of Many',
      blocks: [
        {
          kind: 'text',
          text: 'Applying $X$ to $q_1$ of a three-qubit register means $I \\otimes X \\otimes I$. Every amplitude whose $q_1$ bit is 0 swaps with the amplitude that differs only in that bit — the rest of the label is carried along unchanged.',
        },
        {
          kind: 'text',
          text: 'This is why a single-qubit gate on an $n$-qubit register still touches all $2^n$ amplitudes, and why the cost of simulation grows with the register rather than with the gate.',
        },
        {
          kind: 'text',
          text: 'Controlled gates read the same way, except the operation is applied only on the half of the state where the control bit is 1:',
        },
        { kind: 'math', tex: '\\mathrm{CNOT} = |0\\rangle\\langle0| \\otimes I \;+\; |1\\rangle\\langle1| \\otimes X' },
        {
          kind: 'text',
          text: 'Read as English: "where the control is 0 do nothing; where it is 1 apply $X$" — and crucially, *both* clauses apply at once when the control is in superposition.',
        },
      ],
    },
    {
      id: 'exponential-growth',
      title: 'Why $2^n$ Is the Whole Story',
      blocks: [
        {
          kind: 'text',
          text: 'Each added qubit doubles the number of amplitudes:',
        },
        {
          kind: 'list',
          items: [
            '10 qubits — 1,024 amplitudes. Trivial.',
            '30 qubits — about a billion. A workstation, at a stretch.',
            '50 qubits — about $10^{15}$. Beyond any single machine.',
            '300 qubits — more amplitudes than there are atoms in the observable universe.',
          ],
        },
        {
          kind: 'text',
          text: 'That is why this simulator caps at 8 qubits: not a design limitation, but arithmetic. Every additional wire doubles the work.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'A tempting but wrong conclusion',
          text: 'A 300-qubit register does **not** "store" $2^{300}$ numbers you can use. You can never read them out — measurement returns one basis state. The exponential space is real, but it is only useful when interference concentrates the answer onto outcomes you can actually observe.',
        },
      ],
    },
  ],
}

const entanglement: Topic = {
  slug: 'entanglement',
  title: 'Entanglement',
  blurb: 'States that cannot be written as a product — the resource that makes quantum different.',
  estMinutes: 30,
  sections: [
    {
      id: 'separable',
      title: 'Separable vs Entangled States',
      blocks: [
        {
          kind: 'text',
          text: 'A two-qubit state is **separable** if it can be written as a product of single-qubit states, and **entangled** if it cannot. That is the entire definition.',
        },
        { kind: 'math', tex: '\\tfrac{1}{\\sqrt2}(|00\\rangle + |01\\rangle) = |0\\rangle \\otimes \\tfrac{1}{\\sqrt2}(|0\\rangle + |1\\rangle) \\quad\\checkmark\;\\text{separable}' },
        { kind: 'math', tex: '\\tfrac{1}{\\sqrt2}(|00\\rangle + |11\\rangle) \\neq |a\\rangle \\otimes |b\\rangle \\quad\\text{for any } |a\\rangle, |b\\rangle' },
        {
          kind: 'text',
          text: 'The second cannot be factored. Any product $|a\\rangle \\otimes |b\\rangle$ has amplitudes $a_i b_j$, and matching those against $\\tfrac{1}{\\sqrt2},\\, 0,\\, 0,\\, \\tfrac{1}{\\sqrt2}$ forces $a_0b_1 = 0$ while $a_0b_0 \\neq 0$ and $a_1b_1 \\neq 0$ — a contradiction.',
        },
      ],
    },
    {
      id: 'bell-states',
      title: 'The Bell States',
      blocks: [
        {
          kind: 'text',
          text: 'Four maximally entangled two-qubit states, forming an orthonormal basis:',
        },
        { kind: 'math', tex: '\\begin{aligned} |\\Phi^{\\pm}\\rangle &= \\tfrac{1}{\\sqrt2}(|00\\rangle \\pm |11\\rangle) \\\\ |\\Psi^{\\pm}\\rangle &= \\tfrac{1}{\\sqrt2}(|01\\rangle \\pm |10\\rangle) \\end{aligned}' },
        {
          kind: 'text',
          text: 'Because they are mutually orthogonal, a suitable measurement distinguishes them perfectly — that is what superdense coding exploits, and what teleportation’s Bell measurement performs.',
        },
        { kind: 'circuit', preset: 'bell', caption: 'Change the wire inputs to $|1\\rangle$ to produce the other three Bell states.' },
      ],
    },
    {
      id: 'reduced-density',
      title: 'Reduced Density Matrices',
      summary: 'Why an entangled qubit’s Bloch arrow shrinks.',
      blocks: [
        {
          kind: 'text',
          text: 'To describe one qubit of an entangled pair on its own, you **trace out** the other — sum over everything you are ignoring:',
        },
        { kind: 'math', tex: '\\rho_A = \\mathrm{Tr}_B\\big(|\\psi\\rangle\\langle\\psi|\\big)' },
        {
          kind: 'text',
          text: 'For a Bell state this gives $\\rho_A = \\tfrac12 I$ — the maximally mixed state. Each qubit alone is a perfect coin flip with no phase information whatsoever, even though the pair together is in a completely definite pure state.',
        },
        {
          kind: 'text',
          text: 'This is the sharpest statement of what entanglement is: **the whole is fully determined while the parts are maximally uncertain**. Classically impossible — knowing everything about a system means knowing everything about its parts.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'You can watch this happen',
          text: 'The Bloch spheres in the Circuit Lab are computed exactly this way. Build a Bell state and step backwards a column: before the CNOT both arrows are on the surface, after it both sit at the origin. The purity readout drops from 1 to 0.5.',
        },
      ],
    },
    {
      id: 'no-signalling',
      title: 'No Faster-Than-Light Signalling',
      blocks: [
        {
          kind: 'text',
          text: 'Measuring one half of a Bell pair instantly determines the other. It is natural to think this transmits something — it does not.',
        },
        {
          kind: 'text',
          text: 'Bob’s qubit is maximally mixed **before** Alice measures, and still maximally mixed **after**. His local statistics are identical either way, so no measurement he performs can tell him whether Alice has acted, let alone what she got. The correlation only becomes visible when the two compare results over a classical channel.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Correlation without communication',
          text: 'Two sealed envelopes with matching cards are also perfectly correlated, and nobody calls that spooky. What Bell’s theorem shows is that quantum correlations are **stronger** than any such pre-arranged agreement can produce — while still, provably, carrying no signal.',
        },
      ],
    },
    {
      id: 'ghz',
      title: 'GHZ and Multipartite Entanglement',
      blocks: [
        {
          kind: 'text',
          text: 'Beyond two qubits, entanglement stops being one thing. The three-qubit GHZ state extends the Bell pattern:',
        },
        { kind: 'math', tex: '|\\mathrm{GHZ}\\rangle = \\tfrac{1}{\\sqrt2}(|000\\rangle + |111\\rangle)' },
        {
          kind: 'text',
          text: 'It is fragile in a specific way: measure any one qubit and the other two collapse to a product state, with no entanglement left. The $W$ state $\\tfrac{1}{\\sqrt3}(|001\\rangle + |010\\rangle + |100\\rangle)$ behaves oppositely — lose a qubit and the remaining pair stays entangled.',
        },
        {
          kind: 'text',
          text: 'GHZ and $W$ cannot be converted into one another by local operations. For three or more qubits there are genuinely **inequivalent kinds** of entanglement, not just different amounts.',
        },
        {
          kind: 'text',
          text: 'Build GHZ yourself: $H$ on q0, then CNOT q0→q1, then CNOT q1→q2. All three Bloch arrows collapse to the origin.',
        },
      ],
    },
  ],
}

const measurement: Topic = {
  slug: 'measurement',
  title: 'Measurement',
  blurb: 'The Born rule, collapse, and what a shot histogram is actually telling you.',
  estMinutes: 25,
  sections: [
    {
      id: 'born-rule',
      title: 'The Born Rule',
      blocks: [
        {
          kind: 'text',
          text: 'The bridge between the mathematics and anything you can observe. The probability of outcome $i$ is the squared magnitude of its amplitude:',
        },
        { kind: 'math', tex: 'P(i) = |\\langle i|\\psi\\rangle|^2 = |\\alpha_i|^2' },
        {
          kind: 'text',
          text: 'Squaring is what makes quantum mechanics quantum. Because amplitudes are complex and get squared only at the very end, they can **cancel** on the way — and cancellation of possibilities has no classical counterpart. Probabilities alone can only ever accumulate.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Not derived, assumed',
          text: 'The Born rule is a postulate, not a theorem. Attempts to derive it from the rest of the formalism remain contested. It is the point where the linear algebra is connected to experiment by hand.',
        },
      ],
    },
    {
      id: 'collapse',
      title: 'Collapse',
      blocks: [
        {
          kind: 'text',
          text: 'After measuring outcome $i$, the state is no longer a superposition — it is $|i\\rangle$. Every other amplitude is gone, and the state is renormalised so probabilities sum to 1 again.',
        },
        {
          kind: 'text',
          text: 'Measurement is therefore the one operation in the theory that is **not unitary and not reversible**. Nothing undoes it, and the discarded amplitudes cannot be recovered.',
        },
        {
          kind: 'text',
          text: 'Measuring the same qubit twice in a row gives the same answer both times — the first measurement already fixed it. The Circuit Lab reproduces this: place two measurement gates on one wire and the sampled bits always agree.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Measure late',
          text: 'Collapse destroys the superposition your algorithm depends on. Measuring a working register midway usually ruins the computation, which is why measurement gates almost always sit at the very end of a circuit.',
        },
      ],
    },
    {
      id: 'bases',
      title: 'Measuring in Other Bases',
      blocks: [
        {
          kind: 'text',
          text: 'Hardware measures in the computational basis and nothing else. To measure along another axis you **rotate that axis onto $z$ first**, then measure normally:',
        },
        {
          kind: 'list',
          items: [
            '**$X$ basis** — apply $H$, then measure. Outcome 0 means $|+\\rangle$, 1 means $|-\\rangle$.',
            '**$Y$ basis** — apply $S^\\dagger$ then $H$, then measure.',
            '**$Z$ basis** — measure directly.',
          ],
        },
        {
          kind: 'text',
          text: 'This also explains why the choice of basis matters so much. A qubit in $|+\\rangle$ measured in the $X$ basis gives a certain answer; measured in the computational basis it gives a coin flip. The state has not changed — the question has.',
        },
      ],
    },
    {
      id: 'repeated',
      title: 'Repeated Measurement and Shots',
      blocks: [
        {
          kind: 'text',
          text: 'One run gives one bitstring. To learn a distribution you must prepare and measure the circuit many times — these repetitions are called **shots**.',
        },
        {
          kind: 'text',
          text: 'Estimating a probability $p$ from $N$ shots carries a statistical error of order $\\sqrt{p(1-p)/N}$. Halving your uncertainty costs four times the runs, so precision is expensive:',
        },
        {
          kind: 'list',
          items: [
            '100 shots — roughly ±5% on a 50/50 split.',
            '1,000 shots — roughly ±1.6%.',
            '10,000 shots — roughly ±0.5%.',
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Two views of the same circuit',
          text: 'The Circuit Lab shows both. The **Probabilities** tab gives exact values straight from the state vector — what infinitely many shots would converge to. The **Shots** tab samples for real, with noise. Comparing them is the quickest way to develop intuition for how much data a result actually needs.',
        },
        { kind: 'circuit', preset: 'qrng', caption: 'Run 100 shots, then 8192, and compare how close each gets to an even split.' },
      ],
    },
    {
      id: 'expectation',
      title: 'Expectation Values',
      blocks: [
        {
          kind: 'text',
          text: 'Often you do not want the full distribution, only an average. The expectation value of an observable $A$ in state $|\\psi\\rangle$ is',
        },
        { kind: 'math', tex: '\\langle A \\rangle = \\langle\\psi|A|\\psi\\rangle' },
        {
          kind: 'text',
          text: 'For $Z$ this is simply $P(0) - P(1)$, which is exactly the $z$-component of the Bloch vector. The three Pauli expectation values *are* the Bloch coordinates — which is why the arrow shrinks when a qubit is entangled: all three averages move toward zero together.',
        },
        {
          kind: 'text',
          text: 'Expectation values are what variational algorithms minimise, and they are cheap to estimate: average the $\\pm1$ outcomes over your shots. No full tomography required.',
        },
      ],
    },
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
