/**
 * Seeded PRNG (mulberry32) so shot sampling is reproducible — the same circuit and seed
 * always give the same histogram, which matters for tests and for explaining results.
 */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff)
