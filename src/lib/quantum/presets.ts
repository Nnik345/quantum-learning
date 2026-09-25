/**
 * Working circuits for each algorithm in the Algorithms track.
 *
 * These are the source of truth for both the diagrams shown on the algorithm pages and the
 * "Open in Circuit Lab" handoff, so a reader always experiments with exactly the circuit they
 * just read about. Every one is checked against its textbook result in presets.test.ts — a wrong
 * circuit here would be a wrong lesson, so none of them are taken on trust.
 *
 * Qubit ordering follows the rest of the codebase: q0 is the top wire and the leftmost ket symbol.
 * In registers below, q0 is therefore the MOST significant bit.
 */

import { type Circuit, type Placement } from './circuit'
import { build, g, spread } from './builder'

/**
 * Inverse QFT over three counting wires [a, b, c] (a most significant).
 *
 * Derived by reversing the forward QFT and negating every phase. Used by both phase estimation
 * and Shor, so there is one implementation to get right rather than two.
 */
function inverseQft3(a: number, b: number, c: number, startColumn: number): Placement[] {
  const s = startColumn
  return [
    g('SWAP', [a, c], s),
    g('H', [c], s + 1),
    g('P', [b], s + 2, [c], [-Math.PI / 2]),
    g('H', [b], s + 3),
    g('P', [a], s + 4, [c], [-Math.PI / 4]),
    g('P', [a], s + 5, [b], [-Math.PI / 2]),
    g('H', [a], s + 6),
  ]
}

export interface AlgorithmPreset {
  id: string
  name: string
  /** One line describing what the circuit does, shown under the diagram. */
  summary: string
  circuit: Circuit
}

// ---------------------------------------------------------------------------
// Tier 1 — protocols
// ---------------------------------------------------------------------------

const qrng: AlgorithmPreset = {
  id: 'qrng',
  name: 'Quantum Random Number Generator',
  summary: 'One Hadamard turns |0⟩ into an even superposition; measuring it yields a fair bit.',
  circuit: build(1, 4, [g('H', [0], 0), g('MEASURE', [0], 1)]),
}

const bell: AlgorithmPreset = {
  id: 'bell',
  name: 'Bell State Preparation',
  summary: 'H then CNOT produces (|00⟩ + |11⟩)/√2 — the simplest entangled state.',
  circuit: build(2, 4, [g('H', [0], 0), g('X', [1], 1, [0])]),
}

const superdense: AlgorithmPreset = {
  id: 'superdense',
  name: 'Superdense Coding',
  summary: 'Alice encodes two classical bits (here 01) into one qubit of a shared Bell pair.',
  circuit: build(2, 8, [
    g('H', [0], 0),
    g('X', [1], 1, [0]),
    // Alice's encoding: I → 00, X → 01, Z → 10, ZX → 11.
    g('X', [0], 2),
    // Bob decodes by undoing the Bell preparation.
    g('X', [1], 3, [0]),
    g('H', [0], 4),
    ...spread('MEASURE', [0, 1], 5),
  ]),
}

const teleportation: AlgorithmPreset = {
  id: 'teleportation',
  name: 'Quantum Teleportation',
  summary:
    'Moves q0’s state onto q2 using a Bell pair. Corrections are drawn as quantum controls (deferred measurement) since the simulator has no classical feedforward.',
  circuit: build(
    3,
    8,
    [
      g('H', [1], 0),
      g('X', [2], 1, [1]),
      g('X', [1], 2, [0]),
      g('H', [0], 3),
      g('X', [2], 4, [1]),
      g('Z', [2], 5, [0]),
    ],
    { 0: 'i' }, // the state being teleported
  ),
}

// ---------------------------------------------------------------------------
// Tier 2 — oracles and query complexity
// ---------------------------------------------------------------------------

const deutsch: AlgorithmPreset = {
  id: 'deutsch',
  name: 'Deutsch’s Algorithm',
  summary:
    'Decides whether a one-bit function is constant or balanced in a single query. The oracle here is f(x) = x, which is balanced — so q0 measures 1.',
  circuit: build(
    2,
    6,
    [...spread('H', [0, 1], 0), g('X', [1], 1, [0]), g('H', [0], 2), g('MEASURE', [0], 3)],
    { 1: '1' }, // ancilla starts |1⟩ so H makes |−⟩ and phase kickback works
  ),
}

const deutschJozsa: AlgorithmPreset = {
  id: 'deutsch-jozsa',
  name: 'Deutsch–Jozsa',
  summary:
    'Deutsch scaled to n bits. The oracle is f(x) = x₀ ⊕ x₁ (balanced), so the result is never 000.',
  circuit: build(
    4,
    8,
    [
      ...spread('H', [0, 1, 2, 3], 0),
      g('X', [3], 1, [0]),
      g('X', [3], 2, [1]),
      ...spread('H', [0, 1, 2], 3),
      ...spread('MEASURE', [0, 1, 2], 4),
    ],
    { 3: '1' },
  ),
}

const bernsteinVazirani: AlgorithmPreset = {
  id: 'bernstein-vazirani',
  name: 'Bernstein–Vazirani',
  summary:
    'Recovers the hidden string s = 1011 in one query, where classically four would be needed.',
  circuit: build(
    5,
    8,
    [
      ...spread('H', [0, 1, 2, 3, 4], 0),
      // One CNOT per 1-bit of s = 1011.
      g('X', [4], 1, [0]),
      g('X', [4], 2, [2]),
      g('X', [4], 3, [3]),
      ...spread('H', [0, 1, 2, 3], 4),
      ...spread('MEASURE', [0, 1, 2, 3], 5),
    ],
    { 4: '1' },
  ),
}

const simon: AlgorithmPreset = {
  id: 'simon',
  name: 'Simon’s Algorithm',
  summary:
    'Finds the hidden period s = 11 of a 2-to-1 function. Each run samples a y with y·s = 0, and two independent y values pin s down.',
  circuit: build(4, 8, [
    ...spread('H', [0, 1], 0),
    // Oracle writing f(x) = (x₀⊕x₁, x₀⊕x₁), which satisfies f(x) = f(x ⊕ 11).
    g('X', [2], 1, [0]),
    g('X', [3], 2, [0]),
    g('X', [2], 3, [1]),
    g('X', [3], 4, [1]),
    ...spread('H', [0, 1], 5),
    ...spread('MEASURE', [0, 1], 6),
  ]),
}

// ---------------------------------------------------------------------------
// Tier 3 — amplitude and phase
// ---------------------------------------------------------------------------

const grover: AlgorithmPreset = {
  id: 'grover',
  name: 'Grover’s Search',
  summary:
    'Searches four items for the marked one, |11⟩, in a single iteration — which for N = 4 is exact.',
  circuit: build(2, 10, [
    ...spread('H', [0, 1], 0),
    g('Z', [1], 1, [0]), // oracle: phase-flip |11⟩
    // Diffuser: reflect about the uniform superposition.
    ...spread('H', [0, 1], 2),
    ...spread('X', [0, 1], 3),
    g('Z', [1], 4, [0]),
    ...spread('X', [0, 1], 5),
    ...spread('H', [0, 1], 6),
    ...spread('MEASURE', [0, 1], 7),
  ]),
}

const qft: AlgorithmPreset = {
  id: 'qft',
  name: 'Quantum Fourier Transform',
  summary:
    'Three-qubit QFT. It maps a basis state to an even superposition whose phases wind at a rate set by the input.',
  circuit: build(
    3,
    10,
    [
      g('H', [0], 0),
      g('P', [0], 1, [1], [Math.PI / 2]),
      g('P', [0], 2, [2], [Math.PI / 4]),
      g('H', [1], 3),
      g('P', [1], 4, [2], [Math.PI / 2]),
      g('H', [2], 5),
      g('SWAP', [0, 2], 6),
    ],
    { 2: '1' }, // input |001⟩ = 1
  ),
}

const phaseEstimation: AlgorithmPreset = {
  id: 'phase-estimation',
  name: 'Quantum Phase Estimation',
  summary:
    'Reads the phase of a T gate (φ = 1/8) into three counting wires. The answer 001 is binary 0.001 = 1/8.',
  circuit: build(
    4,
    14,
    [
      ...spread('H', [0, 1, 2], 0),
      // Counting wire k controls U^(2^k); q0 is most significant, so it gets U⁴.
      g('P', [3], 1, [0], [Math.PI]),
      g('P', [3], 2, [1], [Math.PI / 2]),
      g('P', [3], 3, [2], [Math.PI / 4]),
      ...inverseQft3(0, 1, 2, 4),
      ...spread('MEASURE', [0, 1, 2], 11),
    ],
    { 3: '1' }, // |1⟩ is the eigenstate of a phase gate
  ),
}

// ---------------------------------------------------------------------------
// Tier 4 — synthesis
// ---------------------------------------------------------------------------

/**
 * Shor for N = 15, a = 4.
 *
 * Because 15 = 2⁴ − 1, multiplying by a power of two is exactly a cyclic rotation of the four
 * work bits — so modular multiplication by 4 costs two SWAPs instead of an adder network. That is
 * what makes a real end-to-end Shor circuit fit in seven wires.
 *
 * 4² = 16 ≡ 1 (mod 15), so the order is r = 2 and U² = U⁴ = identity: only the last counting wire
 * has anything to do.
 */
const shor: AlgorithmPreset = {
  id: 'shor',
  name: 'Shor’s Algorithm',
  summary:
    'Factors 15 using a = 4. Measuring 000 or 100 gives period r = 2, and gcd(4 ± 1, 15) yields 3 and 5.',
  circuit: build(
    7,
    14,
    [
      ...spread('H', [0, 1, 2], 0),
      // Controlled multiplication by 4 (mod 15) = cyclic rotation of the work register by two.
      g('SWAP', [3, 5], 1, [2]),
      g('SWAP', [4, 6], 2, [2]),
      // U² and U⁴ are the identity, so q1 and q0 control nothing.
      ...inverseQft3(0, 1, 2, 3),
      ...spread('MEASURE', [0, 1, 2], 10),
    ],
    { 6: '1' }, // work register starts at |0001⟩ = 1
  ),
}

// ---------------------------------------------------------------------------

export const ALGORITHM_PRESETS: AlgorithmPreset[] = [
  qrng,
  bell,
  superdense,
  teleportation,
  deutsch,
  deutschJozsa,
  bernsteinVazirani,
  simon,
  grover,
  qft,
  phaseEstimation,
  shor,
]

export const PRESET_BY_ID: Record<string, AlgorithmPreset> = Object.fromEntries(
  ALGORITHM_PRESETS.map((p) => [p.id, p]),
)

export const getPreset = (id: string): AlgorithmPreset | undefined => PRESET_BY_ID[id]
