import katex from 'katex'
import { useMemo } from 'react'

interface TexProps {
  tex: string
  display?: boolean
  className?: string
}

/** Render a LaTeX string. Errors render in red rather than throwing out the whole page. */
export function Tex({ tex, display = false, className }: TexProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,
        errorColor: '#fb7185',
        strict: false,
      })
    } catch {
      return `<span style="color:#fb7185">${tex}</span>`
    }
  }, [tex, display])

  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Text with inline LaTeX. Supports `$...$`, `$$...$$` and `**bold**`, which is the whole
 * authoring vocabulary for a text block — enough for prose, small enough to never surprise.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => splitMath(text), [text])

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.kind === 'math') return <Tex key={i} tex={part.value} display={part.display} />
        return <Bold key={i} text={part.value} />
      })}
    </span>
  )
}

/**
 * Inline emphasis: **bold** and `code`.
 *
 * Code spans earn their place now that the Python guide writes prose about `circuit.cx(0, 1)` —
 * without them a method name is indistinguishable from the sentence around it.
 */
function Bold({ text }: { text: string }) {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
          return (
            <strong key={i} className="font-semibold text-ink">
              {seg.slice(2, -2)}
            </strong>
          )
        }
        if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
          return (
            <code
              key={i}
              className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em] text-cyan"
            >
              {seg.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{seg}</span>
      })}
    </>
  )
}

type Part =
  | { kind: 'text'; value: string }
  | { kind: 'math'; value: string; display: boolean }

/** Split on $$...$$ and $...$, tolerating escaped \$ and unclosed delimiters. */
function splitMath(input: string): Part[] {
  const parts: Part[] = []
  let buffer = ''
  let i = 0

  const flush = () => {
    if (buffer) parts.push({ kind: 'text', value: buffer })
    buffer = ''
  }

  while (i < input.length) {
    const ch = input[i]

    if (ch === '\\' && input[i + 1] === '$') {
      buffer += '$'
      i += 2
      continue
    }

    if (ch === '$') {
      const display = input[i + 1] === '$'
      const delim = display ? '$$' : '$'
      const end = input.indexOf(delim, i + delim.length)
      if (end === -1) {
        // Unclosed — treat the rest as plain text rather than swallowing the page.
        buffer += input.slice(i)
        break
      }
      flush()
      parts.push({ kind: 'math', value: input.slice(i + delim.length, end), display })
      i = end + delim.length
      continue
    }

    buffer += ch
    i++
  }

  flush()
  return parts
}
