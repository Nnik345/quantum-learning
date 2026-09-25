/**
 * State vector simulation.
 *
 * BIT ORDER — the single most important convention in this file.
 * Qubit q0 is the TOP wire of the circuit and the LEFTMOST symbol of a ket: |q0 q1 q2⟩.
 * Internally, qubit q lives at bit position (n - 1 - q) of the basis index.
 *
 *   n = 3, basis index 0b101 = |1 0 1⟩  →  q0 = 1, q1 = 0, q2 = 1
 *
 * This is textbook (Nielsen & Chuang) ordering. Note it is the REVERSE of Qiskit, which puts q0
 * as the least significant bit — so a bitstring printed here reads mirrored compared to Qiskit's.
 */

import { type Complex, type Complex as C, abs2 } from './complex'
import type { CMatrix } from './matrix'
import type { Rng } from './rng'

export const MAX_QUBITS = 8

export interface StateVector {
  n: number
  re: Float64Array
  im: Float64Array
}

/** Bit position within the basis index for qubit `q` of an n-qubit register. */
export const bitPos = (n: number, q: number): number => n - 1 - q

/** Value of qubit `q` in basis state `index`. */
export const bitOf = (index: number, n: number, q: number): number =>
  (index >> bitPos(n, q)) & 1

/** |000…0⟩ */
export function zeroState(n: number): StateVector {
  if (n < 1 || n > MAX_QUBITS) throw new Error(`Qubit count must be 1..${MAX_QUBITS}, got ${n}`)
  const size = 1 << n
  const st: StateVector = { n, re: new Float64Array(size), im: new Float64Array(size) }
  st.re[0] = 1
  return st
}

/**
 * Build a product state from one pair of amplitudes (α, β) per qubit.
 *
 * Each qubit's input is independent, so the register starts unentangled — which is the only kind
 * of starting state a per-wire input control can express.
 */
export function productState(amps: readonly (readonly [Complex, Complex])[]): StateVector {
  const n = amps.length
  if (n < 1 || n > MAX_QUBITS) throw new Error(`Qubit count must be 1..${MAX_QUBITS}, got ${n}`)

  const size = 1 << n
  const st: StateVector = { n, re: new Float64Array(size), im: new Float64Array(size) }

  for (let i = 0; i < size; i++) {
    let re = 1
    let im = 0
    for (let q = 0; q < n; q++) {
      const a = amps[q][bitOf(i, n, q)]
      const nextRe = re * a.re - im * a.im
      const nextIm = re * a.im + im * a.re
      re = nextRe
      im = nextIm
    }
    st.re[i] = re
    st.im[i] = im
  }
  return st
}

export const cloneState = (st: StateVector): StateVector => ({
  n: st.n,
  re: st.re.slice(),
  im: st.im.slice(),
})

export const amplitude = (st: StateVector, index: number): Complex => ({
  re: st.re[index],
  im: st.im[index],
})

/** Basis label without the ket brackets, e.g. index 5 of 3 qubits → "101". */
export function basisLabel(index: number, n: number): string {
  let s = ''
  for (let q = 0; q < n; q++) s += bitOf(index, n, q)
  return s
}

/**
 * Apply a 2^k × 2^k unitary to `targets`, conditioned on every qubit in `controls` being |1⟩.
 *
 * Everything routes through here: X, CNOT, Toffoli, SWAP and controlled custom gates are all the
 * same code path with different matrices and control lists — there are no per-gate special cases.
 *
 * Within the gate's local index, targets[0] is the most significant bit, matching ket ordering.
 * Mutates `st` in place.
 */
export function applyGate(
  st: StateVector,
  m: CMatrix,
  targets: number[],
  controls: number[] = [],
): void {
  const n = st.n
  const k = targets.length
  const dim = 1 << k

  if (m.length !== dim) {
    throw new Error(`Matrix is ${m.length}×${m.length} but ${k} target(s) need ${dim}×${dim}`)
  }
  const touched = new Set([...targets, ...controls])
  if (touched.size !== targets.length + controls.length) {
    throw new Error('A qubit cannot be both a target and a control of the same gate')
  }
  for (const q of touched) {
    if (q < 0 || q >= n) throw new Error(`Qubit ${q} out of range for ${n}-qubit register`)
  }

  const targetPos = targets.map((q) => bitPos(n, q))
  const controlMask = controls.reduce((acc, q) => acc | (1 << bitPos(n, q)), 0)

  // Bit positions the gate does NOT act on. Iterating over their assignments enumerates each
  // 2^k-sized subspace exactly once.
  const restPos: number[] = []
  for (let b = 0; b < n; b++) if (!targetPos.includes(b)) restPos.push(b)

  const gRe = new Float64Array(dim)
  const gIm = new Float64Array(dim)
  const idx = new Int32Array(dim)
  const outRe = new Float64Array(dim)
  const outIm = new Float64Array(dim)

  for (let r = 0; r < 1 << restPos.length; r++) {
    let base = 0
    for (let b = 0; b < restPos.length; b++) if ((r >> b) & 1) base |= 1 << restPos[b]

    // Controls are never targets, so their bits are fixed by `base`.
    if ((base & controlMask) !== controlMask) continue

    // Gather the subspace.
    for (let j = 0; j < dim; j++) {
      let ii = base
      for (let t = 0; t < k; t++) {
        if ((j >> (k - 1 - t)) & 1) ii |= 1 << targetPos[t]
      }
      idx[j] = ii
      gRe[j] = st.re[ii]
      gIm[j] = st.im[ii]
    }

    // Multiply.
    for (let row = 0; row < dim; row++) {
      let sr = 0
      let si = 0
      const mr = m[row]
      for (let col = 0; col < dim; col++) {
        const a = mr[col]
        if (a.re === 0 && a.im === 0) continue
        sr += a.re * gRe[col] - a.im * gIm[col]
        si += a.re * gIm[col] + a.im * gRe[col]
      }
      outRe[row] = sr
      outIm[row] = si
    }

    // Scatter back.
    for (let row = 0; row < dim; row++) {
      st.re[idx[row]] = outRe[row]
      st.im[idx[row]] = outIm[row]
    }
  }
}

/** Probability of each basis state. */
export function probabilities(st: StateVector): Float64Array {
  const out = new Float64Array(st.re.length)
  for (let i = 0; i < out.length; i++) out[i] = st.re[i] * st.re[i] + st.im[i] * st.im[i]
  return out
}

/** Probability that measuring `q` in the computational basis yields 1. */
export function probabilityOfOne(st: StateVector, q: number): number {
  const p = bitPos(st.n, q)
  let acc = 0
  for (let i = 0; i < st.re.length; i++) {
    if ((i >> p) & 1) acc += st.re[i] * st.re[i] + st.im[i] * st.im[i]
  }
  return acc
}

/**
 * Probability that the chosen wires read `bits`, summed over every other wire.
 *
 * The generalisation of `probabilityOfOne` to a subset of the register. Needed whenever only part
 * of the register is the answer — Shor's counting wires carry the period while the work register
 * holds whatever it happens to hold, and asking about the full basis state would be asking about
 * both at once.
 *
 * `wires` and `bits` are in the site's display order, so `wires: [0, 1, 2]` with `bits: '100'`
 * means q0 = 1, q1 = 0, q2 = 0.
 */
export function marginalProbability(st: StateVector, wires: number[], bits: string): number {
  if (wires.length !== bits.length) return 0

  const mask = wires.reduce((m, q) => m | (1 << bitPos(st.n, q)), 0)
  const want = wires.reduce(
    (v, q, k) => (bits[k] === '1' ? v | (1 << bitPos(st.n, q)) : v),
    0,
  )

  let acc = 0
  for (let i = 0; i < st.re.length; i++) {
    if ((i & mask) === want) acc += st.re[i] * st.re[i] + st.im[i] * st.im[i]
  }
  return acc
}

export const norm = (st: StateVector): number => {
  let acc = 0
  for (let i = 0; i < st.re.length; i++) acc += st.re[i] * st.re[i] + st.im[i] * st.im[i]
  return Math.sqrt(acc)
}

/**
 * Single-qubit reduced density matrix: trace out every other qubit.
 * ρ[a][b] = Σ_e ψ(a,e) · conj(ψ(b,e))
 */
export function reducedDensityMatrix(st: StateVector, q: number): CMatrix {
  const p = bitPos(st.n, q)
  let r00 = 0
  let r11 = 0
  let r01re = 0
  let r01im = 0

  for (let i = 0; i < st.re.length; i++) {
    if ((i >> p) & 1) continue // iterate over the qubit-is-0 half; j is its partner
    const j = i | (1 << p)
    r00 += st.re[i] * st.re[i] + st.im[i] * st.im[i]
    r11 += st.re[j] * st.re[j] + st.im[j] * st.im[j]
    // ψ_0 · conj(ψ_1)
    r01re += st.re[i] * st.re[j] + st.im[i] * st.im[j]
    r01im += st.im[i] * st.re[j] - st.re[i] * st.im[j]
  }

  return [
    [{ re: r00, im: 0 }, { re: r01re, im: r01im }],
    [{ re: r01re, im: -r01im }, { re: r11, im: 0 }],
  ]
}

export interface Bloch {
  x: number
  y: number
  z: number
  /** |r|. 1 = pure state on the surface, 0 = maximally mixed at the centre. */
  length: number
  /** Tr(ρ²) = (1 + |r|²)/2. Drops below 1 exactly when the qubit is entangled with another. */
  purity: number
}

/**
 * Bloch vector from the reduced density matrix: r = (Tr(ρσx), Tr(ρσy), Tr(ρσz)).
 *
 * The arrow shrinks inside the sphere when the qubit is entangled — which is what makes
 * entanglement visible rather than merely asserted.
 */
export function blochVector(st: StateVector, q: number): Bloch {
  const rho = reducedDensityMatrix(st, q)
  const x = 2 * rho[0][1].re
  const y = -2 * rho[0][1].im
  const z = rho[0][0].re - rho[1][1].re
  const length = Math.hypot(x, y, z)
  return { x, y, z, length, purity: (1 + length * length) / 2 }
}

/**
 * Measure `q` in the computational basis, collapsing and renormalising in place.
 * Returns the observed bit. Used by shot sampling.
 */
export function measureQubit(st: StateVector, q: number, rng: Rng): 0 | 1 {
  const p1 = probabilityOfOne(st, q)
  const outcome: 0 | 1 = rng() < p1 ? 1 : 0
  const p = bitPos(st.n, q)
  const keep = outcome === 1 ? 1 : 0

  const prob = outcome === 1 ? p1 : 1 - p1
  if (prob <= 1e-12) {
    // Numerically unreachable outcome; nothing sensible to renormalise to.
    throw new Error(`Measured a zero-probability outcome on q${q}`)
  }
  const scale = 1 / Math.sqrt(prob)

  for (let i = 0; i < st.re.length; i++) {
    if (((i >> p) & 1) === keep) {
      st.re[i] *= scale
      st.im[i] *= scale
    } else {
      st.re[i] = 0
      st.im[i] = 0
    }
  }
  return outcome
}

/** Amplitudes above a visibility threshold, largest first — what the state panel renders. */
export function significantAmplitudes(
  st: StateVector,
  threshold = 1e-10,
): { index: number; label: string; amp: C; probability: number }[] {
  const out: { index: number; label: string; amp: C; probability: number }[] = []
  for (let i = 0; i < st.re.length; i++) {
    const amp = { re: st.re[i], im: st.im[i] }
    const probability = abs2(amp)
    if (probability > threshold) {
      out.push({ index: i, label: basisLabel(i, st.n), amp, probability })
    }
  }
  return out.sort((a, b) => b.probability - a.probability || a.index - b.index)
}
