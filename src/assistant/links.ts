/**
 * Deciding which links in model output are safe to render.
 *
 * Model output is untrusted. Turning an arbitrary model-supplied URL into something clickable
 * inside a page the reader trusts is not a risk worth taking for a citation feature, so only paths
 * that resolve to a real route on this site become links. Everything else — external URLs,
 * javascript:, protocol-relative, unknown internal paths — renders as plain text.
 */

import { TRACKS, getTopic } from '../content/registry'

const STATIC_ROUTES = new Set(['/', '/path', '/reference', '/circuit'])

/**
 * True when `href` names a page that actually exists here.
 *
 * Rejects anything with a scheme or authority outright rather than trying to classify it: the only
 * acceptable shape is a site-relative path.
 */
export function isInternalPath(href: string): boolean {
  const raw = href.trim()
  if (!raw.startsWith('/')) return false // relative, external, or a scheme like javascript:
  if (raw.startsWith('//')) return false // protocol-relative points off-site

  // Compare without a query or hash, but validate the path itself.
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, '') || '/'
  if (STATIC_ROUTES.has(path)) return true

  const segments = path.split('/').filter(Boolean)
  if (segments.length === 1) return TRACKS.some((t) => t.id === segments[0])
  if (segments.length === 2) return Boolean(getTopic(segments[0], segments[1]))
  return false
}

export interface TextSegment {
  kind: 'text' | 'link'
  text: string
  href?: string
}

/**
 * Split prose on markdown links, keeping only the ones that point somewhere real.
 *
 * A rejected link keeps its label as ordinary text, so an answer never loses words just because a
 * citation was wrong.
 */
export function splitLinks(input: string): TextSegment[] {
  const segments: TextSegment[] = []
  const pattern = /\[([^\]]+)\]\(([^)\s]+)\)/g

  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', text: input.slice(cursor, match.index) })
    }
    const [, label, href] = match
    if (isInternalPath(href)) segments.push({ kind: 'link', text: label, href: href.trim() })
    else segments.push({ kind: 'text', text: label })
    cursor = match.index + match[0].length
  }

  if (cursor < input.length) segments.push({ kind: 'text', text: input.slice(cursor) })
  return segments.length > 0 ? segments : [{ kind: 'text', text: input }]
}
