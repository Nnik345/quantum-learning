/**
 * Deciding whether two circuits do the same thing.
 *
 * This exists to grade exercises, and the rule it enforces is that only BEHAVIOUR counts. A learner
 * who reaches the right answer with the gates in different columns, by a different decomposition, or
 * with a measurement left on the end of a wire has built a correct circuit, and marking them wrong
 * for not matching an author's arrangement would be both unfair and untrue. So nothing here ever
 * compares placements — every check runs the circuits and compares the states that come out.
 *
 * Global phase is unobservable, so it is ignored throughout. |00⟩+|11⟩ and −(|00⟩+|11⟩) are the same
 * physical state and compare equal.
 */

import { type Circuit, type QubitInput } from './circuit'
import { simulate } from './simulate'
import { probabilities, type StateVector } from './state'

/** Amplitudes below this are treated as zero. Matches the threshold used elsewhere in the lib. */
export const DEFAULT_TOLERANCE = 1e-6

/** The final state of a circuit — what every comparison here is actually about. */
export function finalState(circuit: Circuit): StateVector {
  const { states } = simulate(circuit)
  return states[states.length - 1]
}

/**
 * The same circuit started from basis state |k⟩ instead of its authored inputs.
 *
 * Used to compare circuits as OPERATIONS rather than as one-shot recipes. Bit `q` of the register
 * follows the site convention — q0 is the most significant — which is what `basisLabel` prints, so
 * a failure message and the sweep agree about which input was tried.
 */
export function withBasisInput(circuit: Circuit, k: number): Circuit {
  const n = circuit.numQubits
  const inputs: QubitInput[] = Array.from({ length: n }, (_, q) => ({
    preset: (k >> (n - 1 - q)) & 1 ? '1' : '0',
  }))
  return { ...circuit, inputs }
}

/**
 * Do two state vectors describe the same physical state?
 *
 * Equal up to one overall phase: the largest amplitude of `a` fixes the phase factor λ, and every
 * other amplitude must agree once λ is divided out. Comparing amplitude-by-amplitude without this
 * would reject correct answers that happen to come out with an opposite sign — which is most of
 * them, since a Z in a different place changes the sign of everything.
 */
export function equalUpToGlobalPhase(
  a: StateVector,
  b: StateVector,
  tolerance = DEFAULT_TOLERANCE,
): boolean {
  if (a.n !== b.n) return false

  const pivot = pivotIndex(a, tolerance)
  if (pivot === undefined) {
    // `a` is the zero vector (only reachable from an invalid circuit); `b` must be too.
    return pivotIndex(b, tolerance) === undefined
  }

  const lambda = phaseFactor(a, b, pivot)
  if (!lambda) return false
  return matchesWithPhase(a, b, lambda, tolerance)
}

/** Do two states give the same measurement statistics? Blind to every phase, relative included. */
export function sameDistribution(
  a: StateVector,
  b: StateVector,
  tolerance = DEFAULT_TOLERANCE,
): boolean {
  if (a.n !== b.n) return false
  const pa = probabilities(a)
  const pb = probabilities(b)
  for (let i = 0; i < pa.length; i++) {
    if (Math.abs(pa[i] - pb[i]) > tolerance) return false
  }
  return true
}

/**
 * Do two circuits implement the same operation, not merely produce the same output from |0…0⟩?
 *
 * Runs both from every basis input and requires agreement up to a SINGLE shared phase. Allowing a
 * separate phase per input would accept circuits that differ by a relative phase between basis
 * states — a genuinely different operation that only looks right when started from |0…0⟩.
 *
 * At most 2^n simulations. Exercises are small, and the cost is negligible next to being right.
 */
export function implementsSameOperation(
  student: Circuit,
  reference: Circuit,
  tolerance = DEFAULT_TOLERANCE,
): boolean {
  if (student.numQubits !== reference.numQubits) return false

  let lambda: { re: number; im: number } | undefined

  for (let k = 0; k < 1 << reference.numQubits; k++) {
    const got = finalState(withBasisInput(student, k))
    const want = finalState(withBasisInput(reference, k))
    if (got.n !== want.n) return false

    const pivot = pivotIndex(want, tolerance)
    if (pivot === undefined) {
      if (pivotIndex(got, tolerance) !== undefined) return false
      continue
    }

    // The first column that says anything fixes the phase for every column after it.
    const here = phaseFactor(want, got, pivot)
    if (!here) return false
    if (!lambda) lambda = here
    else if (Math.abs(here.re - lambda.re) > tolerance || Math.abs(here.im - lambda.im) > tolerance) {
      return false
    }

    if (!matchesWithPhase(want, got, lambda, tolerance)) return false
  }

  return true
}

// ---------------------------------------------------------------------------

/** Index of the largest amplitude, or undefined when the state is (numerically) zero. */
function pivotIndex(st: StateVector, tolerance: number): number | undefined {
  let best = -1
  let bestMag = tolerance
  for (let i = 0; i < st.re.length; i++) {
    const mag = Math.hypot(st.re[i], st.im[i])
    if (mag > bestMag) {
      bestMag = mag
      best = i
    }
  }
  return best === -1 ? undefined : best
}

/** λ such that b[pivot] = λ·a[pivot], rejected unless |λ| = 1 — anything else is not a phase. */
function phaseFactor(
  a: StateVector,
  b: StateVector,
  pivot: number,
): { re: number; im: number } | undefined {
  const ar = a.re[pivot]
  const ai = a.im[pivot]
  const denom = ar * ar + ai * ai
  if (denom === 0) return undefined

  // (b/a) for complex a, b.
  const re = (b.re[pivot] * ar + b.im[pivot] * ai) / denom
  const im = (b.im[pivot] * ar - b.re[pivot] * ai) / denom

  return Math.abs(Math.hypot(re, im) - 1) > 1e-6 ? undefined : { re, im }
}

/** Every amplitude of `b` equals λ times the corresponding amplitude of `a`. */
function matchesWithPhase(
  a: StateVector,
  b: StateVector,
  lambda: { re: number; im: number },
  tolerance: number,
): boolean {
  for (let i = 0; i < a.re.length; i++) {
    const re = a.re[i] * lambda.re - a.im[i] * lambda.im
    const im = a.re[i] * lambda.im + a.im[i] * lambda.re
    if (Math.abs(re - b.re[i]) > tolerance || Math.abs(im - b.im[i]) > tolerance) return false
  }
  return true
}
