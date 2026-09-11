/** Complex arithmetic. Values are plain objects so they stay easy to inspect and log. */

export interface Complex {
  re: number
  im: number
}

export const c = (re: number, im = 0): Complex => ({ re, im })

export const ZERO: Complex = { re: 0, im: 0 }
export const ONE: Complex = { re: 1, im: 0 }
export const I: Complex = { re: 0, im: 1 }

export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im })
export const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im })
export const neg = (a: Complex): Complex => ({ re: -a.re, im: -a.im })
export const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im })
export const scale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s })

export const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
})

export function div(a: Complex, b: Complex): Complex {
  const d = b.re * b.re + b.im * b.im
  if (d === 0) throw new Error('Division by zero')
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }
}

/** |z|² — cheaper than abs() when you only need to compare or sum probabilities. */
export const abs2 = (a: Complex): number => a.re * a.re + a.im * a.im
export const abs = (a: Complex): number => Math.hypot(a.re, a.im)
export const arg = (a: Complex): number => Math.atan2(a.im, a.re)

/** e^z */
export function exp(a: Complex): Complex {
  const r = Math.exp(a.re)
  return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) }
}

/** Principal square root. */
export function sqrt(a: Complex): Complex {
  if (a.im === 0 && a.re >= 0) return { re: Math.sqrt(a.re), im: 0 }
  const r = abs(a)
  return { re: Math.sqrt((r + a.re) / 2), im: Math.sign(a.im || 1) * Math.sqrt((r - a.re) / 2) }
}

/** a^b via exp(b · log a). Handles the common `e^(i*pi/4)` shape exactly enough for gate entry. */
export function pow(a: Complex, b: Complex): Complex {
  if (a.re === 0 && a.im === 0) return b.re === 0 && b.im === 0 ? ONE : ZERO
  const logA: Complex = { re: Math.log(abs(a)), im: arg(a) }
  return exp(mul(b, logA))
}

export const cos = (a: Complex): Complex => ({
  re: Math.cos(a.re) * Math.cosh(a.im),
  im: -Math.sin(a.re) * Math.sinh(a.im),
})

export const sin = (a: Complex): Complex => ({
  re: Math.sin(a.re) * Math.cosh(a.im),
  im: Math.cos(a.re) * Math.sinh(a.im),
})

export const equal = (a: Complex, b: Complex, tol = 1e-9): boolean =>
  Math.abs(a.re - b.re) <= tol && Math.abs(a.im - b.im) <= tol

/** Human-readable form, e.g. "0.707", "-i", "0.5+0.5i". Used in the state panel and matrix editor. */
export function format(a: Complex, digits = 3): string {
  const round = (x: number) => {
    const r = Number(x.toFixed(digits))
    return Object.is(r, -0) ? 0 : r
  }
  const re = round(a.re)
  const im = round(a.im)
  if (im === 0) return `${re}`
  if (re === 0) return im === 1 ? 'i' : im === -1 ? '-i' : `${im}i`
  const sign = im < 0 ? '-' : '+'
  const mag = Math.abs(im)
  return `${re}${sign}${mag === 1 ? '' : mag}i`
}
