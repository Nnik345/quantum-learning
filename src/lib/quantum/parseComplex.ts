/**
 * A small recursive-descent parser for complex-valued expressions, so custom gate matrices can be
 * typed the way they appear in a textbook: `1/sqrt(2)`, `e^(i*pi/4)`, `-i`, `(1+i)/2`.
 *
 * Grammar (precedence low to high):
 *   expr   := term (('+' | '-') term)*
 *   term   := factor ((('*' | '/') | implicit) factor)*
 *   factor := unary ('^' factor)?          -- right associative
 *   unary  := ('+' | '-') unary | atom
 *   atom   := number | constant | func '(' expr ')' | '(' expr ')'
 *
 * Implicit multiplication is accepted between adjacent factors, so `2i` and `3(1+i)` work.
 */

import {
  type Complex,
  c,
  I,
  add,
  sub,
  mul,
  div,
  neg,
  exp,
  sqrt,
  pow,
  sin,
  cos,
} from './complex'

export class ParseError extends Error {
  constructor(
    message: string,
    /** Character offset into the source, for pointing at the problem. */
    readonly position: number,
  ) {
    super(message)
    this.name = 'ParseError'
  }
}

type TokenType = 'number' | 'ident' | 'op' | 'lparen' | 'rparen' | 'end'

interface Token {
  type: TokenType
  value: string
  pos: number
}

const CONSTANTS: Record<string, Complex> = {
  i: I,
  j: I,
  pi: c(Math.PI),
  π: c(Math.PI),
  e: c(Math.E),
  tau: c(2 * Math.PI),
}

const FUNCTIONS: Record<string, (z: Complex) => Complex> = {
  sqrt,
  exp,
  sin,
  cos,
  conj: (z) => ({ re: z.re, im: -z.im }),
  abs: (z) => c(Math.hypot(z.re, z.im)),
}

function tokenise(src: string): Token[] {
  const tokens: Token[] = []
  let k = 0
  while (k < src.length) {
    const ch = src[k]
    if (/\s/.test(ch)) {
      k++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      const start = k
      while (k < src.length && /[0-9.]/.test(src[k])) k++
      const value = src.slice(start, k)
      if ((value.match(/\./g) ?? []).length > 1) {
        throw new ParseError(`Malformed number "${value}"`, start)
      }
      tokens.push({ type: 'number', value, pos: start })
      continue
    }
    if (/[a-zA-Zπ]/.test(ch)) {
      const start = k
      while (k < src.length && /[a-zA-Z0-9π]/.test(src[k])) k++
      tokens.push({ type: 'ident', value: src.slice(start, k), pos: start })
      continue
    }
    if ('+-*/^'.includes(ch)) {
      tokens.push({ type: 'op', value: ch, pos: k++ })
      continue
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch, pos: k++ })
      continue
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch, pos: k++ })
      continue
    }
    throw new ParseError(`Unexpected character "${ch}"`, k)
  }
  tokens.push({ type: 'end', value: '', pos: src.length })
  return tokens
}

/** Parse a complex expression. Throws ParseError with a character position on bad input. */
export function parseComplex(src: string): Complex {
  const text = src.trim()
  if (text === '') throw new ParseError('Empty expression', 0)

  const tokens = tokenise(text)
  let pos = 0
  const peek = (): Token => tokens[pos]
  const next = (): Token => tokens[pos++]

  const startsFactor = (t: Token): boolean =>
    t.type === 'number' || t.type === 'ident' || t.type === 'lparen'

  function parseExpr(): Complex {
    let acc = parseTerm()
    for (;;) {
      const t = peek()
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
        next()
        const rhs = parseTerm()
        acc = t.value === '+' ? add(acc, rhs) : sub(acc, rhs)
      } else return acc
    }
  }

  function parseTerm(): Complex {
    let acc = parseFactor()
    for (;;) {
      const t = peek()
      if (t.type === 'op' && (t.value === '*' || t.value === '/')) {
        next()
        const rhs = parseFactor()
        if (t.value === '/') {
          if (rhs.re === 0 && rhs.im === 0) throw new ParseError('Division by zero', t.pos)
          acc = div(acc, rhs)
        } else acc = mul(acc, rhs)
      } else if (startsFactor(t)) {
        acc = mul(acc, parseFactor()) // implicit multiplication: 2i, 3(1+i)
      } else return acc
    }
  }

  function parseFactor(): Complex {
    const base = parseUnary()
    const t = peek()
    if (t.type === 'op' && t.value === '^') {
      next()
      return pow(base, parseFactor()) // right associative
    }
    return base
  }

  function parseUnary(): Complex {
    const t = peek()
    if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      next()
      const v = parseUnary()
      return t.value === '-' ? neg(v) : v
    }
    return parseAtom()
  }

  function parseAtom(): Complex {
    const t = next()
    if (t.type === 'number') return c(Number(t.value))

    if (t.type === 'ident') {
      const key = t.value.toLowerCase()
      if (peek().type === 'lparen') {
        const fn = FUNCTIONS[key]
        if (!fn) throw new ParseError(`Unknown function "${t.value}"`, t.pos)
        next() // consume '('
        const arg = parseExpr()
        if (peek().type !== 'rparen') {
          throw new ParseError(`Missing ")" after ${t.value}(...)`, peek().pos)
        }
        next()
        return fn(arg)
      }
      const constant = CONSTANTS[key] ?? CONSTANTS[t.value]
      if (!constant) throw new ParseError(`Unknown symbol "${t.value}"`, t.pos)
      return constant
    }

    if (t.type === 'lparen') {
      const v = parseExpr()
      if (peek().type !== 'rparen') throw new ParseError('Missing ")"', peek().pos)
      next()
      return v
    }

    if (t.type === 'end') throw new ParseError('Unexpected end of expression', t.pos)
    throw new ParseError(`Unexpected "${t.value}"`, t.pos)
  }

  const result = parseExpr()
  if (peek().type !== 'end') {
    throw new ParseError(`Unexpected "${peek().value}"`, peek().pos)
  }
  if (!Number.isFinite(result.re) || !Number.isFinite(result.im)) {
    throw new ParseError('Expression is not a finite number', 0)
  }
  return result
}

export interface ParseCellResult {
  value?: Complex
  error?: string
}

/** Parse one matrix cell, converting thrown errors into a message the dialog can display. */
export function parseCell(src: string): ParseCellResult {
  try {
    return { value: parseComplex(src) }
  } catch (err) {
    if (err instanceof ParseError) return { error: `${err.message} (at position ${err.position + 1})` }
    return { error: err instanceof Error ? err.message : 'Invalid expression' }
  }
}
