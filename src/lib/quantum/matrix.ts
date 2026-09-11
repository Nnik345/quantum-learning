/** Dense complex matrices. Small by construction — gates act on at most a few qubits. */

import { type Complex, ZERO, ONE, add, mul, conj, abs } from './complex'

export type CMatrix = Complex[][]

export function identity(n: number): CMatrix {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? ONE : ZERO)),
  )
}

export function matmul(a: CMatrix, b: CMatrix): CMatrix {
  const n = a.length
  const m = b[0].length
  const k = b.length
  if (a[0].length !== k) throw new Error(`Shape mismatch: ${a.length}x${a[0].length} · ${k}x${m}`)
  const out: CMatrix = []
  for (let i = 0; i < n; i++) {
    const row: Complex[] = []
    for (let j = 0; j < m; j++) {
      let acc = ZERO
      for (let p = 0; p < k; p++) acc = add(acc, mul(a[i][p], b[p][j]))
      row.push(acc)
    }
    out.push(row)
  }
  return out
}

/** Conjugate transpose, U†. */
export function dagger(a: CMatrix): CMatrix {
  return Array.from({ length: a[0].length }, (_, i) =>
    Array.from({ length: a.length }, (_, j) => conj(a[j][i])),
  )
}

/** Kronecker product. */
export function tensor(a: CMatrix, b: CMatrix): CMatrix {
  const out: CMatrix = []
  for (let i = 0; i < a.length; i++) {
    for (let k = 0; k < b.length; k++) {
      const row: Complex[] = []
      for (let j = 0; j < a[0].length; j++) {
        for (let l = 0; l < b[0].length; l++) row.push(mul(a[i][j], b[k][l]))
      }
      out.push(row)
    }
  }
  return out
}

export interface UnitarityResult {
  ok: boolean
  /** Largest |(U†U - I)ᵢⱼ|. Reported to the user so a near-miss reads differently from nonsense. */
  maxDeviation: number
}

/**
 * Check U†U = I. Custom gates are rejected unless they pass — a non-unitary "gate" would
 * silently break normalisation and every downstream probability.
 */
export function isUnitary(m: CMatrix, tol = 1e-9): UnitarityResult {
  if (m.length === 0 || m.length !== m[0].length) return { ok: false, maxDeviation: Infinity }
  const product = matmul(dagger(m), m)
  const id = identity(m.length)
  let maxDeviation = 0
  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < m.length; j++) {
      const d = abs({
        re: product[i][j].re - id[i][j].re,
        im: product[i][j].im - id[i][j].im,
      })
      if (d > maxDeviation) maxDeviation = d
    }
  }
  return { ok: maxDeviation <= tol, maxDeviation }
}

export function isSquarePowerOfTwo(m: CMatrix): boolean {
  const n = m.length
  if (n < 2 || m.some((r) => r.length !== n)) return false
  return (n & (n - 1)) === 0
}
