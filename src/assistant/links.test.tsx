/**
 * Which links in model output are allowed to be clickable.
 *
 * This is a trust boundary, not a formatting nicety. Everything rendered here was written by the
 * model, and a citation feature is not worth making the page a launchpad for arbitrary URLs — so the
 * interesting cases below are the ones that must NOT become links.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { isInternalPath, splitLinks } from './links'
import { MessageView } from './MessageView'
import type { DisplayMessage } from './useAssistant'

afterEach(cleanup)

describe('isInternalPath', () => {
  it('accepts the site’s real routes', () => {
    for (const path of [
      '/',
      '/reference',
      '/circuit',
      '/algorithms',
      '/algorithms/grovers-search',
      '/theory/dirac-notation',
      '/math/complex-numbers',
      '/algorithms/grovers-search#diffuser',
      '/algorithms/grovers-search/',
    ]) {
      expect(isInternalPath(path), path).toBe(true)
    }
  })

  it('rejects anything that could leave the site or execute', () => {
    for (const href of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'https://example.com',
      'http://example.com/algorithms/grovers-search',
      '//example.com',
      '//example.com/circuit',
      'mailto:someone@example.com',
      'vbscript:msgbox(1)',
      ' javascript:alert(1)',
    ]) {
      expect(isInternalPath(href), href).toBe(false)
    }
  })

  it('rejects internal-looking paths that do not exist', () => {
    for (const href of [
      '/maths/complex-numbers', // the track is "math"; a plausible near-miss
      '/algorithms/shors-alogrithm', // a plausible typo
      '/theory/does-not-exist',
      '/nonsense',
      '/algorithms/grovers-search/extra',
      '/../etc/passwd',
      '',
    ]) {
      expect(isInternalPath(href), href).toBe(false)
    }
  })
})

describe('splitLinks', () => {
  it('splits a citation out of surrounding prose', () => {
    const segments = splitLinks('See [Grover’s Search](/algorithms/grovers-search) for the diffuser.')
    expect(segments).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', text: 'Grover’s Search', href: '/algorithms/grovers-search' },
      { kind: 'text', text: ' for the diffuser.' },
    ])
  })

  it('keeps the label of a rejected link as plain text, so no words are lost', () => {
    const segments = splitLinks('Read [the docs](https://example.com) first.')
    expect(segments.every((s) => s.kind === 'text')).toBe(true)
    expect(segments.map((s) => s.text).join('')).toBe('Read the docs first.')
  })

  it('leaves prose without links untouched', () => {
    expect(splitLinks('H puts $|0\\rangle$ into $|+\\rangle$.')).toEqual([
      { kind: 'text', text: 'H puts $|0\\rangle$ into $|+\\rangle$.' },
    ])
  })

  it('handles several links in one line', () => {
    const links = splitLinks(
      'Compare [A](/theory/quantum-gates) with [B](/circuit) and [C](javascript:void 0).',
    ).filter((s) => s.kind === 'link')
    expect(links.map((l) => l.href)).toEqual(['/theory/quantum-gates', '/circuit'])
  })
})

describe('rendered model prose', () => {
  const message = (content: string): DisplayMessage => ({
    id: 'm1',
    role: 'assistant',
    content,
    circuits: [],
    snippets: [],
    toolsUsed: [],
  })

  const show = (content: string) =>
    render(
      <MemoryRouter>
        <MessageView message={message(content)} />
      </MemoryRouter>,
    )

  it('renders a citation as a navigable link', () => {
    show('Covered in [Grover’s Search](/algorithms/grovers-search).')
    const link = screen.getByRole('link', { name: 'Grover’s Search' })
    expect(link).toHaveAttribute('href', '/algorithms/grovers-search')
  })

  it('renders a fabricated or external link as plain text', () => {
    const { container } = show(
      'See [this page](https://example.com/evil) and [that one](/theory/imaginary-topic).',
    )
    expect(screen.queryAllByRole('link')).toHaveLength(0)
    // The words survive even though the links did not.
    expect(container.textContent).toContain('See this page and that one.')
    expect(container.innerHTML).not.toContain('example.com')
  })

  it('cites from inside bullets and numbered steps too', () => {
    show('- First, read [Dirac Notation](/theory/dirac-notation)\n1. Then [try it](/circuit)')
    expect(screen.getByRole('link', { name: 'Dirac Notation' })).toHaveAttribute(
      'href',
      '/theory/dirac-notation',
    )
    expect(screen.getByRole('link', { name: 'try it' })).toHaveAttribute('href', '/circuit')
  })
})
