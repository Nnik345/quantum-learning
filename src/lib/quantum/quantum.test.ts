import { describe, it, expect } from 'vitest'

import { abs, equal, c, ONE, ZERO } from './complex'
import { isUnitary, matmul, dagger, identity } from './matrix'
import {
  applyGate,
  basisLabel,
  bitOf,
  blochVector,
  measureQubit,
  norm,
  probabilities,
  probabilityOfOne,
  reducedDensityMatrix,
  zeroState,
  type StateVector,
} from './state'
import {
  BUILTIN_GATES,
  BUILTIN_BY_ID,
  H_MATRIX,
  X_MATRIX,
  Y_MATRIX,
  Z_MATRIX,
  SWAP_MATRIX,
} from './gates'
import {
  checkPlacement,
  createCircuit,
  spanOf,
  type Circuit,
  type Placement,
} from './circuit'
import { simulate, runShots } from './simulate'
import { parseComplex, ParseError } from './parseComplex'
import { mulberry32 } from './rng'

// --- helpers ---------------------------------------------------------------

/** Build a basis state from a ket string in display order: ket('01') = |q0=0, q1=1⟩. */
function ket(bits: string): StateVector {
  const n = bits.length
  const st = zeroState(n)
  st.re[0] = 0
  let idx = 0
  for (let q = 0; q < n; q++) if (bits[q] === '1') idx |= 1 << (n - 1 - q)
  st.re[idx] = 1
  return st
}

/** The unique basis label of a state that is a single basis vector; throws otherwise. */
function soleKet(st: StateVector): string {
  const probs = probabilities(st)
  const hits = [...probs].map((p, i) => ({ p, i })).filter(({ p }) => p > 1e-9)
  expect(hits).toHaveLength(1)
  expect(hits[0].p).toBeCloseTo(1, 12)
  return basisLabel(hits[0].i, st.n)
}

const place = (over: Partial<Placement> & { gate: string; targets: number[] }): Placement => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  controls: [],
  params: [],
  column: 0,
  ...over,
})

function circuitOf(numQubits: number, placements: Placement[]): Circuit {
  return { ...createCircuit(numQubits, 12), placements }
}

// --- complex & matrix ------------------------------------------------------

describe('complex arithmetic', () => {
  it('multiplies and divides', () => {
    expect(equal(parseComplex('(1+i)*(1-i)'), c(2))).toBe(true)
    expect(equal(parseComplex('1/i'), c(0, -1))).toBe(true)
  })
})

describe('isUnitary', () => {
  it('accepts every built-in gate matrix', () => {
    for (const g of BUILTIN_GATES) {
      if (!g.matrix) continue
      const params = g.params?.map((p) => p.default) ?? []
      const { ok, maxDeviation } = isUnitary(g.matrix(params))
      expect(`${g.id}:${ok}`).toBe(`${g.id}:true`)
      expect(maxDeviation).toBeLessThan(1e-12)
    }
  })

  it('rejects a non-unitary matrix and reports the deviation', () => {
    const bad = [
      [ONE, ONE],
      [ONE, ONE],
    ]
    const result = isUnitary(bad)
    expect(result.ok).toBe(false)
    expect(result.maxDeviation).toBeGreaterThan(0.5)
  })

  it('rejects a matrix that is close but not quite unitary', () => {
    const nearly = [
      [c(1.0001), ZERO],
      [ZERO, ONE],
    ]
    expect(isUnitary(nearly).ok).toBe(false)
  })
})

describe('gate algebra', () => {
  it('T·T = S', () => {
    const t = BUILTIN_BY_ID.T.matrix!([])
    const s = BUILTIN_BY_ID.S.matrix!([])
    const tt = matmul(t, t)
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) expect(equal(tt[i][j], s[i][j])).toBe(true)
    }
  })

  it('H is its own inverse', () => {
    const hh = matmul(H_MATRIX, H_MATRIX)
    const id = identity(2)
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) expect(equal(hh[i][j], id[i][j])).toBe(true)
    }
  })

  it('X·Y·Z = iI', () => {
    const product = matmul(matmul(X_MATRIX, Y_MATRIX), Z_MATRIX)
    expect(equal(product[0][0], c(0, 1))).toBe(true)
    expect(equal(product[1][1], c(0, 1))).toBe(true)
    expect(equal(product[0][1], ZERO)).toBe(true)
  })

  it('dagger of a rotation inverts it', () => {
    const rx = BUILTIN_BY_ID.RX.matrix!([0.7])
    const product = matmul(dagger(rx), rx)
    const id = identity(2)
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) expect(equal(product[i][j], id[i][j])).toBe(true)
    }
  })
})

// --- bit ordering ----------------------------------------------------------

describe('bit ordering (q0 is the top wire and the leftmost ket symbol)', () => {
  it('maps basis indices to labels in display order', () => {
    // index 0b101 with n=3 → q0=1, q1=0, q2=1
    expect(basisLabel(0b101, 3)).toBe('101')
    expect(bitOf(0b101, 3, 0)).toBe(1)
    expect(bitOf(0b101, 3, 1)).toBe(0)
    expect(bitOf(0b101, 3, 2)).toBe(1)
  })

  it('round-trips through ket()', () => {
    expect(soleKet(ket('011'))).toBe('011')
    expect(soleKet(ket('100'))).toBe('100')
  })

  it('applies a single-qubit gate to the right wire', () => {
    const st = ket('000')
    applyGate(st, X_MATRIX, [1])
    expect(soleKet(st)).toBe('010')
  })
})

// --- single-qubit gates ----------------------------------------------------

describe('single-qubit gates', () => {
  it('H|0⟩ = |+⟩', () => {
    const st = ket('0')
    applyGate(st, H_MATRIX, [0])
    expect(st.re[0]).toBeCloseTo(Math.SQRT1_2, 12)
    expect(st.re[1]).toBeCloseTo(Math.SQRT1_2, 12)
    expect(st.im[0]).toBeCloseTo(0, 12)
  })

  it('H|1⟩ = |−⟩', () => {
    const st = ket('1')
    applyGate(st, H_MATRIX, [0])
    expect(st.re[0]).toBeCloseTo(Math.SQRT1_2, 12)
    expect(st.re[1]).toBeCloseTo(-Math.SQRT1_2, 12)
  })

  it('X flips, Z phases, Y does both', () => {
    const x = ket('0')
    applyGate(x, X_MATRIX, [0])
    expect(soleKet(x)).toBe('1')

    const z = ket('1')
    applyGate(z, Z_MATRIX, [0])
    expect(z.re[1]).toBeCloseTo(-1, 12)

    const y = ket('0')
    applyGate(y, Y_MATRIX, [0])
    expect(y.im[1]).toBeCloseTo(1, 12)
    expect(y.re[1]).toBeCloseTo(0, 12)
  })

  it('RZ leaves probabilities untouched', () => {
    const st = ket('0')
    applyGate(st, H_MATRIX, [0])
    const before = [...probabilities(st)]
    applyGate(st, BUILTIN_BY_ID.RZ.matrix!([1.234]), [0])
    const after = [...probabilities(st)]
    after.forEach((p, i) => expect(p).toBeCloseTo(before[i], 12))
  })
})

// --- controlled gates ------------------------------------------------------

describe('controlled gates', () => {
  it('CNOT with control q0, target q1 (control above target)', () => {
    const cases: [string, string][] = [
      ['00', '00'],
      ['01', '01'],
      ['10', '11'],
      ['11', '10'],
    ]
    for (const [input, expected] of cases) {
      const st = ket(input)
      applyGate(st, X_MATRIX, [1], [0])
      expect(`${input}→${soleKet(st)}`).toBe(`${input}→${expected}`)
    }
  })

  it('CNOT with control q1, target q0 (control BELOW target)', () => {
    // The mirror-image case. If bit ordering is wrong anywhere, this is where it shows.
    const cases: [string, string][] = [
      ['00', '00'],
      ['01', '11'],
      ['10', '10'],
      ['11', '01'],
    ]
    for (const [input, expected] of cases) {
      const st = ket(input)
      applyGate(st, X_MATRIX, [0], [1])
      expect(`${input}→${soleKet(st)}`).toBe(`${input}→${expected}`)
    }
  })

  it('CNOT across non-adjacent wires (control q0, target q2)', () => {
    const st = ket('100')
    applyGate(st, X_MATRIX, [2], [0])
    expect(soleKet(st)).toBe('101')
  })

  it('Toffoli over the full truth table', () => {
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        for (let t = 0; t < 2; t++) {
          const input = `${a}${b}${t}`
          const st = ket(input)
          applyGate(st, X_MATRIX, [2], [0, 1])
          const expected = `${a}${b}${a && b ? 1 - t : t}`
          expect(`${input}→${soleKet(st)}`).toBe(`${input}→${expected}`)
        }
      }
    }
  })

  it('CZ is symmetric in its two wires', () => {
    for (const bits of ['00', '01', '10', '11']) {
      const a = ket(bits)
      const b = ket(bits)
      applyGate(a, Z_MATRIX, [1], [0])
      applyGate(b, Z_MATRIX, [0], [1])
      for (let i = 0; i < 4; i++) {
        expect(a.re[i]).toBeCloseTo(b.re[i], 12)
        expect(a.im[i]).toBeCloseTo(b.im[i], 12)
      }
    }
  })

  it('a control on a qubit in superposition entangles rather than branches', () => {
    const st = ket('00')
    applyGate(st, H_MATRIX, [0])
    applyGate(st, X_MATRIX, [1], [0])
    expect(st.re[0b00]).toBeCloseTo(Math.SQRT1_2, 12)
    expect(st.re[0b11]).toBeCloseTo(Math.SQRT1_2, 12)
    expect(st.re[0b01]).toBeCloseTo(0, 12)
    expect(st.re[0b10]).toBeCloseTo(0, 12)
  })
})

describe('SWAP', () => {
  it('exchanges the two wires over every basis state', () => {
    for (const bits of ['00', '01', '10', '11']) {
      const st = ket(bits)
      applyGate(st, SWAP_MATRIX, [0, 1])
      expect(`${bits}→${soleKet(st)}`).toBe(`${bits}→${bits[1]}${bits[0]}`)
    }
  })

  it('swaps non-adjacent wires without disturbing the middle one', () => {
    const st = ket('100')
    applyGate(st, SWAP_MATRIX, [0, 2])
    expect(soleKet(st)).toBe('001')

    const st2 = ket('010')
    applyGate(st2, SWAP_MATRIX, [0, 2])
    expect(soleKet(st2)).toBe('010')
  })
})

// --- entangled states ------------------------------------------------------

describe('canonical entangled states', () => {
  it('builds a Bell state', () => {
    const st = ket('00')
    applyGate(st, H_MATRIX, [0])
    applyGate(st, X_MATRIX, [1], [0])
    const probs = probabilities(st)
    expect(probs[0b00]).toBeCloseTo(0.5, 12)
    expect(probs[0b11]).toBeCloseTo(0.5, 12)
    expect(probs[0b01]).toBeCloseTo(0, 12)
    expect(probs[0b10]).toBeCloseTo(0, 12)
  })

  it('builds a 3-qubit GHZ state', () => {
    const st = ket('000')
    applyGate(st, H_MATRIX, [0])
    applyGate(st, X_MATRIX, [1], [0])
    applyGate(st, X_MATRIX, [2], [1])
    const probs = probabilities(st)
    expect(probs[0b000]).toBeCloseTo(0.5, 12)
    expect(probs[0b111]).toBeCloseTo(0.5, 12)
    expect([...probs].filter((p) => p > 1e-9)).toHaveLength(2)
  })
})

// --- normalisation ---------------------------------------------------------

describe('normalisation', () => {
  it('is preserved through randomised circuits', () => {
    const rng = mulberry32(20260910)
    const unitaries = BUILTIN_GATES.filter((g) => g.matrix && g.arity === 1)

    for (let trial = 0; trial < 40; trial++) {
      const n = 1 + Math.floor(rng() * 4)
      const st = zeroState(n)
      for (let step = 0; step < 25; step++) {
        const g = unitaries[Math.floor(rng() * unitaries.length)]
        const target = Math.floor(rng() * n)
        const controls: number[] = []
        if (n > 1 && rng() < 0.4) {
          const cq = Math.floor(rng() * n)
          if (cq !== target) controls.push(cq)
        }
        applyGate(st, g.matrix!(g.params?.map(() => rng() * Math.PI * 2) ?? []), [target], controls)
      }
      expect(norm(st)).toBeCloseTo(1, 12)
    }
  })
})

// --- reduced density matrix & Bloch ---------------------------------------

describe('reduced density matrix and Bloch vectors', () => {
  it('gives a unit-length vector for a product state', () => {
    const st = ket('01')
    const b0 = blochVector(st, 0)
    const b1 = blochVector(st, 1)
    expect(b0.z).toBeCloseTo(1, 12)
    expect(b0.length).toBeCloseTo(1, 12)
    expect(b1.z).toBeCloseTo(-1, 12)
    expect(b1.purity).toBeCloseTo(1, 12)
  })

  it('places |+⟩ on +x and |+i⟩ on +y', () => {
    const plus = ket('0')
    applyGate(plus, H_MATRIX, [0])
    const bx = blochVector(plus, 0)
    expect(bx.x).toBeCloseTo(1, 12)
    expect(bx.y).toBeCloseTo(0, 12)
    expect(bx.z).toBeCloseTo(0, 12)

    // S|+⟩ = |+i⟩
    applyGate(plus, BUILTIN_BY_ID.S.matrix!([]), [0])
    const by = blochVector(plus, 0)
    expect(by.y).toBeCloseTo(1, 12)
    expect(by.x).toBeCloseTo(0, 12)
  })

  it('collapses both Bloch vectors to the origin for a Bell state', () => {
    // The signature of maximal entanglement: each qubit alone is maximally mixed.
    const st = ket('00')
    applyGate(st, H_MATRIX, [0])
    applyGate(st, X_MATRIX, [1], [0])
    for (const q of [0, 1]) {
      const b = blochVector(st, q)
      expect(b.length).toBeCloseTo(0, 12)
      expect(b.purity).toBeCloseTo(0.5, 12)
    }
  })

  it('produces a trace-one density matrix', () => {
    const st = ket('00')
    applyGate(st, H_MATRIX, [0])
    applyGate(st, BUILTIN_BY_ID.RY.matrix!([0.8]), [1])
    const rho = reducedDensityMatrix(st, 1)
    expect(rho[0][0].re + rho[1][1].re).toBeCloseTo(1, 12)
    // Hermitian: ρ10 = conj(ρ01)
    expect(rho[1][0].re).toBeCloseTo(rho[0][1].re, 12)
    expect(rho[1][0].im).toBeCloseTo(-rho[0][1].im, 12)
  })
})

// --- measurement -----------------------------------------------------------

describe('measurement', () => {
  it('collapses and renormalises', () => {
    const st = ket('0')
    applyGate(st, H_MATRIX, [0])
    const outcome = measureQubit(st, 0, mulberry32(7))
    expect(norm(st)).toBeCloseTo(1, 12)
    expect(soleKet(st)).toBe(String(outcome))
  })

  it('is repeatable: measuring the same qubit twice agrees', () => {
    const rng = mulberry32(99)
    for (let trial = 0; trial < 20; trial++) {
      const st = ket('0')
      applyGate(st, H_MATRIX, [0])
      const first = measureQubit(st, 0, rng)
      const second = measureQubit(st, 0, rng)
      expect(second).toBe(first)
    }
  })

  it('measuring one half of a Bell pair fixes the other', () => {
    const rng = mulberry32(2024)
    for (let trial = 0; trial < 20; trial++) {
      const st = ket('00')
      applyGate(st, H_MATRIX, [0])
      applyGate(st, X_MATRIX, [1], [0])
      const a = measureQubit(st, 0, rng)
      expect(probabilityOfOne(st, 1)).toBeCloseTo(a, 12)
    }
  })
})

// --- shot sampling ---------------------------------------------------------

describe('shot sampling', () => {
  const bell = (): Circuit =>
    circuitOf(2, [
      place({ gate: 'H', targets: [0], column: 0 }),
      place({ gate: 'X', targets: [1], controls: [0], column: 1 }),
    ])

  it('samples a Bell state as roughly half 00 and half 11', () => {
    const { counts } = runShots(bell(), 4000, 12345)
    expect(Object.keys(counts).sort()).toEqual(['00', '11'])
    expect(counts['00']).toBeGreaterThan(1700)
    expect(counts['00']).toBeLessThan(2300)
    expect(counts['00'] + counts['11']).toBe(4000)
  })

  it('is reproducible for a given seed', () => {
    const a = runShots(bell(), 500, 42)
    const b = runShots(bell(), 500, 42)
    expect(a.counts).toEqual(b.counts)
  })

  it('honours explicit measurement gates and reports only measured wires', () => {
    const circuit = circuitOf(2, [
      place({ gate: 'H', targets: [0], column: 0 }),
      place({ gate: 'X', targets: [1], controls: [0], column: 1 }),
      place({ gate: 'MEASURE', targets: [0], column: 2 }),
    ])
    const result = runShots(circuit, 1000, 5)
    expect(result.measuredAllAtEnd).toBe(false)
    expect(result.measuredQubits).toEqual([0])
    expect(Object.keys(result.counts).sort()).toEqual(['0', '1'])
  })

  it('gives a deterministic circuit a single outcome', () => {
    const circuit = circuitOf(3, [
      place({ gate: 'X', targets: [0], column: 0 }),
      place({ gate: 'X', targets: [1], column: 0 }),
      place({ gate: 'X', targets: [2], controls: [0, 1], column: 1 }),
    ])
    const { counts } = runShots(circuit, 200, 1)
    expect(counts).toEqual({ '111': 200 })
  })
})

// --- circuit model ---------------------------------------------------------

describe('circuit placement rules', () => {
  it('spans every wire between the topmost and bottommost, including controls', () => {
    expect(spanOf(place({ gate: 'X', targets: [3], controls: [0] }))).toEqual({ top: 0, bottom: 3 })
  })

  it('rejects a gate dropped underneath a control line', () => {
    const circuit = circuitOf(4, [
      place({ id: 'a', gate: 'X', targets: [3], controls: [0], column: 0 }),
    ])
    const blocked = checkPlacement(circuit, place({ gate: 'H', targets: [1], column: 0 }))
    expect(blocked.ok).toBe(false)
    expect(blocked.reason).toMatch(/X already occupies q1 in this column/)
  })

  it('allows the same wire in a different column', () => {
    const circuit = circuitOf(4, [
      place({ id: 'a', gate: 'X', targets: [3], controls: [0], column: 0 }),
    ])
    expect(checkPlacement(circuit, place({ gate: 'H', targets: [1], column: 1 })).ok).toBe(true)
  })

  it('ignores the placement being moved', () => {
    const existing = place({ id: 'a', gate: 'H', targets: [1], column: 0 })
    const circuit = circuitOf(4, [existing])
    expect(checkPlacement(circuit, { ...existing, targets: [2] }, 'a').ok).toBe(true)
  })

  it('rejects a wire used as both target and control', () => {
    const circuit = circuitOf(4, [])
    const result = checkPlacement(circuit, place({ gate: 'X', targets: [1], controls: [1] }))
    expect(result.ok).toBe(false)
  })

  it('rejects the wrong number of targets', () => {
    const circuit = circuitOf(4, [])
    expect(checkPlacement(circuit, place({ gate: 'SWAP', targets: [0] })).ok).toBe(false)
    expect(checkPlacement(circuit, place({ gate: 'SWAP', targets: [0, 1] })).ok).toBe(true)
  })

  it('rejects a controlled measurement', () => {
    const circuit = circuitOf(4, [])
    expect(checkPlacement(circuit, place({ gate: 'MEASURE', targets: [0], controls: [1] })).ok).toBe(
      false,
    )
  })

  it('rejects wires outside the register', () => {
    const circuit = circuitOf(2, [])
    expect(checkPlacement(circuit, place({ gate: 'H', targets: [5] })).ok).toBe(false)
  })
})

// --- simulate() ------------------------------------------------------------

describe('simulate', () => {
  it('captures the state after every column', () => {
    const circuit = circuitOf(2, [
      place({ gate: 'H', targets: [0], column: 0 }),
      place({ gate: 'X', targets: [1], controls: [0], column: 1 }),
    ])
    const { states, errors } = simulate(circuit)
    expect(errors).toEqual([])

    // Initial state.
    expect(probabilities(states[0])[0]).toBeCloseTo(1, 12)
    // After column 0: |+0⟩, still separable.
    expect(blochVector(states[1], 0).x).toBeCloseTo(1, 12)
    expect(blochVector(states[1], 1).z).toBeCloseTo(1, 12)
    // After column 1: Bell state, both Bloch vectors at the origin.
    expect(blochVector(states[2], 0).length).toBeCloseTo(0, 12)
    expect(blochVector(states[2], 1).length).toBeCloseTo(0, 12)
  })

  it('treats measurement as a no-op and flags it', () => {
    const circuit = circuitOf(1, [
      place({ gate: 'H', targets: [0], column: 0 }),
      place({ gate: 'MEASURE', targets: [0], column: 1 }),
    ])
    const { states, hasMeasurement } = simulate(circuit)
    expect(hasMeasurement).toBe(true)
    const final = states[states.length - 1]
    expect(probabilities(final)[0]).toBeCloseTo(0.5, 12)
  })

  it('reports unknown gates instead of throwing', () => {
    const circuit = circuitOf(1, [place({ gate: 'NOPE', targets: [0], column: 0 })])
    const { errors } = simulate(circuit)
    expect(errors.length).toBeGreaterThan(0)
  })

  it('applies a custom gate identically to its built-in equivalent', () => {
    const s = Math.SQRT1_2
    const circuit: Circuit = {
      ...createCircuit(1, 4),
      customGates: {
        myh: {
          id: 'myh',
          label: 'Ĥ',
          name: 'My Hadamard',
          arity: 1,
          source: [
            ['1/sqrt(2)', '1/sqrt(2)'],
            ['1/sqrt(2)', '-1/sqrt(2)'],
          ],
          matrix: [
            [c(s), c(s)],
            [c(s), c(-s)],
          ],
        },
      },
      placements: [place({ gate: 'custom:myh', targets: [0], column: 0 })],
    }
    const { states, errors } = simulate(circuit)
    expect(errors).toEqual([])
    expect(states[1].re[0]).toBeCloseTo(s, 12)
    expect(states[1].re[1]).toBeCloseTo(s, 12)
  })
})

// --- expression parser -----------------------------------------------------

describe('parseComplex', () => {
  it('parses the forms that appear in gate matrices', () => {
    expect(parseComplex('1').re).toBeCloseTo(1, 12)
    expect(parseComplex('0').re).toBeCloseTo(0, 12)
    expect(parseComplex('-1').re).toBeCloseTo(-1, 12)
    expect(parseComplex('i').im).toBeCloseTo(1, 12)
    expect(parseComplex('-i').im).toBeCloseTo(-1, 12)

    const inv = parseComplex('1/sqrt(2)')
    expect(inv.re).toBeCloseTo(Math.SQRT1_2, 12)

    const t = parseComplex('e^(i*pi/4)')
    expect(t.re).toBeCloseTo(Math.SQRT1_2, 12)
    expect(t.im).toBeCloseTo(Math.SQRT1_2, 12)

    expect(parseComplex('exp(i*pi)').re).toBeCloseTo(-1, 12)
  })

  it('handles implicit multiplication', () => {
    expect(parseComplex('2i').im).toBeCloseTo(2, 12)
    expect(parseComplex('3(1+i)').re).toBeCloseTo(3, 12)
  })

  it('respects precedence and associativity', () => {
    expect(parseComplex('1+2*3').re).toBeCloseTo(7, 12)
    expect(parseComplex('(1+2)*3').re).toBeCloseTo(9, 12)
    expect(parseComplex('2^3^2').re).toBeCloseTo(512, 9) // right associative
  })

  it('accepts whitespace and unicode pi', () => {
    expect(parseComplex('  1 / sqrt( 2 ) ').re).toBeCloseTo(Math.SQRT1_2, 12)
    expect(parseComplex('π').re).toBeCloseTo(Math.PI, 12)
  })

  it('reports errors with a position', () => {
    expect(() => parseComplex('')).toThrow(ParseError)
    expect(() => parseComplex('1+')).toThrow(/end of expression/i)
    expect(() => parseComplex('(1+2')).toThrow(/Missing "\)"/)
    expect(() => parseComplex('foo(1)')).toThrow(/Unknown function/)
    expect(() => parseComplex('q')).toThrow(/Unknown symbol/)
    expect(() => parseComplex('1/0')).toThrow(/Division by zero/)
    expect(() => parseComplex('1..2')).toThrow(/Malformed number/)

    try {
      parseComplex('1 + @')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(ParseError)
      expect((err as ParseError).position).toBe(4)
    }
  })

  it('round-trips a parsed matrix through the unitarity check', () => {
    const cells = [
      ['1/sqrt(2)', '1/sqrt(2)'],
      ['1/sqrt(2)', '-1/sqrt(2)'],
    ]
    const m = cells.map((row) => row.map(parseComplex))
    expect(isUnitary(m).ok).toBe(true)

    const phase = [
      ['1', '0'],
      ['0', 'e^(i*pi/4)'],
    ].map((row) => row.map(parseComplex))
    expect(isUnitary(phase).ok).toBe(true)
    expect(abs(phase[1][1])).toBeCloseTo(1, 12)
  })
})
