/**
 * The exercises, and how each one is graded.
 *
 * Every exercise is pinned to a path step and may only use what the site has taught by then —
 * `syllabus.ts` derives that envelope from the content and `exercises.test.ts` enforces it, so this
 * file cannot quietly drift ahead of the writing.
 *
 * A `build` exercise carries its `solution` as the single source of truth: it is both the target the
 * learner is graded against and the specimen the syllabus check inspects. There is no second copy to
 * fall out of step. Crucially the solution is never shown and never compared gate-by-gate — it is
 * simulated, and only its behaviour is used.
 *
 * Choosing `grade` is the main way to be unfair, so it is decided per exercise:
 *
 *   'state'      reach this state from these inputs. Any route there is correct.
 *   'operation'  behave like this on EVERY input. Right for oracles, which must be right for all x.
 *
 * Getting that backwards rejects correct work: a Bell pair built with the control the other way
 * round reaches the identical state by a different operation, and must pass.
 */

import { type Circuit } from '../lib/quantum/circuit'
import { build, g, spread } from '../lib/quantum/builder'
import { abs2, c } from '../lib/quantum/complex'
import { getPreset } from '../lib/quantum/presets'

/*
 * 'state'        reach this exact state. Right when the prompt NAMES a state.
 * 'operation'    behave like this on every input. Right for oracles.
 * 'distribution' match these outcome probabilities, whatever the phases. Right when the prompt asks
 *                for a measurement result — rejecting |−⟩ for a task that asked for "50% each"
 *                would be telling a learner they are wrong about something they got right.
 */
export type GradingMode = 'state' | 'operation' | 'distribution'

interface BaseExercise {
  id: string
  /** Path topic this belongs to; also fixes which syllabus envelope applies. */
  slug: string
  prompt: string
  hint?: string
}

export interface BuildExercise extends BaseExercise {
  kind: 'build'
  grade: GradingMode
  /** What success looks like, in words. The gate list is never shown. */
  target: string
  solution: Circuit
  /** Preloaded onto the board, which makes this a fix-it rather than a blank start. */
  startFrom?: Circuit
}

export interface PredictExercise extends BaseExercise {
  kind: 'predict'
  /** The verified circuit being reasoned about. Stored by id so there is no second copy of it. */
  presetId: string
  /** Wires being read, and the reading asked about. Other wires are summed over. */
  wires: number[]
  bits: string
  /** Accepted slack, in percentage points. */
  tolerance: number
}

/** The circuit a predict exercise refers to. */
export const predictCircuit = (exercise: PredictExercise): Circuit =>
  getPreset(exercise.presetId)!.circuit

export interface ValueExercise extends BaseExercise {
  kind: 'value'
  /** Computed here from the site's own arithmetic rather than typed in as a literal. */
  expected: number
  tolerance: number
  unit: string
}

export type Exercise = BuildExercise | PredictExercise | ValueExercise

// ---------------------------------------------------------------------------
// Circuits used by the exercises, written with the same builders as the presets
// ---------------------------------------------------------------------------

/** |0⟩ → |−⟩. H makes |+⟩, Z flips it to |−⟩. X then H reaches the same place. */
const minusFromZero = build(1, 4, [g('H', [0], 0), g('Z', [0], 1)])

/** The canonical Bell pair. A learner may equally well put H on q1 and control from there. */
const bellPair = build(2, 4, [g('H', [0], 0), g('X', [1], 1, [0])])

/**
 * Deutsch–Jozsa on two input wires, querying the balanced f(x) = x0 XOR x1.
 *
 * Three wires: q0 and q1 carry x, q2 is the phase-kickback ancilla prepared in |1⟩.
 */
const djCorrect = build(
  3,
  7,
  [
    ...spread('H', [0, 1, 2], 0),
    g('X', [2], 1, [0]),
    g('X', [2], 2, [1]),
    ...spread('H', [0, 1], 3),
  ],
  { 2: '1' },
)

/** The same circuit with the second query controlled from q0 again — so f collapses to a constant. */
const djBroken = build(
  3,
  7,
  [
    ...spread('H', [0, 1, 2], 0),
    g('X', [2], 1, [0]),
    g('X', [2], 2, [0]),
    ...spread('H', [0, 1], 3),
  ],
  { 2: '1' },
)

/** Grover on two wires, marking |11⟩. Oracle and diffuser are both a controlled Z. */
const groverCorrect = build(2, 8, [
  ...spread('H', [0, 1], 0),
  g('Z', [1], 1, [0]),
  ...spread('H', [0, 1], 2),
  ...spread('X', [0, 1], 3),
  g('Z', [1], 4, [0]),
  ...spread('X', [0, 1], 5),
  ...spread('H', [0, 1], 6),
])

/**
 * Grover with the oracle written once per wire.
 *
 * A controlled Z is symmetric, so "Z on q1 controlled by q0" and "Z on q0 controlled by q1" are the
 * SAME gate. Writing both applies it twice, it cancels to nothing, and the marking silently
 * disappears — the circuit still runs and still looks like Grover.
 */
const groverBroken = build(2, 9, [
  ...spread('H', [0, 1], 0),
  g('Z', [1], 1, [0]),
  g('Z', [0], 2, [1]),
  ...spread('H', [0, 1], 3),
  ...spread('X', [0, 1], 4),
  g('Z', [1], 5, [0]),
  ...spread('X', [0, 1], 6),
  ...spread('H', [0, 1], 7),
])

// ---------------------------------------------------------------------------

export const EXERCISES: Exercise[] = [
  {
    kind: 'value',
    id: 'amplitude-to-probability',
    slug: 'complex-numbers',
    prompt:
      'A qubit has amplitude $\\alpha = \\tfrac{1+i}{2}$ on the outcome $|0\\rangle$. What is the probability of measuring $0$, as a percentage?',
    hint: 'The Born rule squares the modulus. For $a + bi$ that is $a^2 + b^2$ — no trigonometry needed.',
    // Computed with the site's own complex arithmetic, so the answer cannot be mistyped.
    expected: abs2(c(0.5, 0.5)) * 100,
    tolerance: 0.5,
    unit: '%',
  },
  {
    kind: 'build',
    id: 'reach-minus',
    slug: 'quantum-gates',
    grade: 'state',
    prompt:
      'Starting from $|0\\rangle$ on a single wire, build a circuit that leaves the qubit in $|-\\rangle$.',
    target: '|−⟩ — an even superposition with a minus sign on |1⟩',
    hint: 'H turns |0⟩ into |+⟩. Something then has to flip the sign of the |1⟩ half. There is more than one way in.',
    solution: minusFromZero,
  },
  {
    kind: 'build',
    id: 'build-bell-pair',
    slug: 'bell-states',
    grade: 'state',
    prompt:
      'On two wires starting from $|00\\rangle$, build the Bell state $\\tfrac{1}{\\sqrt2}(|00\\rangle + |11\\rangle)$.',
    target: '(|00⟩ + |11⟩)/√2 — both qubits correlated, neither with a state of its own',
    hint: 'One wire needs a superposition first; the other has to follow it. Which wire you start on does not matter.',
    solution: bellPair,
  },
  {
    kind: 'build',
    id: 'fix-dj-oracle',
    slug: 'deutsch-jozsa',
    grade: 'operation',
    prompt:
      'This Deutsch–Jozsa circuit should query the balanced function $f(x_0, x_1) = x_0 \\oplus x_1$, but its oracle is wrong — it currently computes a constant, so the algorithm reports the opposite answer. Fix the oracle.',
    target: 'an oracle computing f(x₀, x₁) = x₀ ⊕ x₁, correct for every input',
    hint: 'A balanced parity needs a query from each input wire. Look carefully at where the second one is controlled from.',
    solution: djCorrect,
    startFrom: djBroken,
  },
  {
    kind: 'build',
    id: 'fix-grover-oracle',
    slug: 'grovers-search',
    grade: 'state',
    prompt:
      'This Grover circuit should find $|11\\rangle$ with certainty, but it comes out flat — every outcome equally likely. The marking step is cancelling itself out. Fix it.',
    target: 'all of the amplitude on |11⟩',
    hint: 'A controlled Z is symmetric: which wire holds the dot and which holds the Z makes no difference. So what happens if you write it on both?',
    solution: groverCorrect,
    startFrom: groverBroken,
  },
  {
    kind: 'predict',
    id: 'shor-counting-register',
    slug: 'shors-algorithm',
    prompt:
      'Run the circuit above and read only the three counting wires, q0 to q2. What is the probability that they read $100$, as a percentage?',
    hint: 'The work register is not part of the reading, so add up every outcome whose first three bits are 100.',
    presetId: 'shor',
    wires: [0, 1, 2],
    bits: '100',
    tolerance: 2,
  },
]

export const getExercise = (id: string): Exercise | undefined =>
  EXERCISES.find((e) => e.id === id)

export const exercisesFor = (slug: string): Exercise[] =>
  EXERCISES.filter((e) => e.slug === slug)
