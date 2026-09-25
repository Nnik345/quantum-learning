/**
 * The guided path as a reader experiences it: progress that persists, a front page that always
 * offers one obvious next step, and topic pages that know where they sit.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '../App'
import { useProgress, PROGRESS_KEY, statusOf } from './useProgress'
import { PATH, PATH_LENGTH, pathStepFor, prerequisitesOf } from '../content/path'

vi.mock('../components/LazyBlochSphere', () => ({
  BlochSphere: () => <div data-testid="bloch" />,
}))

beforeEach(() => window.localStorage.clear())

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

const stored = () => JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}')

// --- the progress store ----------------------------------------------------

describe('progress', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.completedCount).toBe(0)
    expect(result.current.total).toBe(PATH_LENGTH)
    expect(result.current.isFresh).toBe(true)
    expect(result.current.next?.slug).toBe('complex-numbers')
  })

  it('separates visiting from completing', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markVisited('complex-numbers'))

    // Visiting shows signs of life without claiming the step is done.
    expect(result.current.visited.has('complex-numbers')).toBe(true)
    expect(result.current.completed.has('complex-numbers')).toBe(false)
    expect(result.current.completedCount).toBe(0)
    expect(result.current.next?.slug).toBe('complex-numbers')
    expect(result.current.isFresh).toBe(false)
  })

  it('advances the next step once something is completed', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('complex-numbers'))

    expect(result.current.completedCount).toBe(1)
    expect(result.current.next?.slug).toBe('vectors-and-matrices')
    // Completing implies having visited.
    expect(result.current.visited.has('complex-numbers')).toBe(true)
  })

  it('persists across a remount', () => {
    const first = renderHook(() => useProgress())
    act(() => first.result.current.markComplete('complex-numbers'))
    first.unmount()

    const second = renderHook(() => useProgress())
    expect(second.result.current.completedCount).toBe(1)
    expect(second.result.current.next?.slug).toBe('vectors-and-matrices')
  })

  it('can un-complete a step', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('complex-numbers'))
    act(() => result.current.markIncomplete('complex-numbers'))

    expect(result.current.completedCount).toBe(0)
    // Still visited — un-marking says "not done", not "never seen".
    expect(result.current.visited.has('complex-numbers')).toBe(true)
  })

  it('resets everything', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('complex-numbers'))
    act(() => result.current.markVisited('dirac-notation'))
    act(() => result.current.reset())

    expect(result.current.completedCount).toBe(0)
    expect(result.current.visited.size).toBe(0)
    expect(result.current.isFresh).toBe(true)
  })

  it('reports a percentage for the bar', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.percent).toBe(0)
    act(() => {
      for (const step of PATH.slice(0, 11)) result.current.markComplete(step.slug)
    })
    expect(result.current.completedCount).toBe(11)
    expect(result.current.percent).toBe(50)
  })

  it('ignores slugs that are not on the path', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('not-a-real-topic'))
    expect(result.current.completedCount).toBe(0)
  })

  it('drops unknown or corrupt stored entries rather than trusting them', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, visited: ['deleted-topic', 42, null], completed: ['complex-numbers', 'gone'] }),
    )
    const { result } = renderHook(() => useProgress())

    // A renamed or removed topic must not be able to mark a real step done.
    expect(result.current.completed.has('complex-numbers')).toBe(true)
    expect(result.current.completedCount).toBe(1)
    expect(result.current.visited.size).toBe(0)
  })

  it('survives unparseable storage', () => {
    window.localStorage.setItem(PROGRESS_KEY, 'not json at all')
    const { result } = renderHook(() => useProgress())
    expect(result.current.completedCount).toBe(0)
  })

  it('writes a versioned payload', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('complex-numbers'))
    expect(stored().version).toBe(2)
    expect(stored().completed).toEqual(['complex-numbers'])
  })

  // --- exercises ---------------------------------------------------------
  //
  // Solving is recorded separately from completing. Conflating them would let a new exercise
  // retroactively un-complete a step somebody had already finished.

  it('records a solved exercise without touching completion', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('quantum-gates'))
    act(() => result.current.markSolved('reach-minus'))

    expect(result.current.solved.has('reach-minus')).toBe(true)
    expect(result.current.completed.has('quantum-gates')).toBe(true)
    expect(stored().solved).toEqual(['reach-minus'])
  })

  it('ignores an exercise id that does not exist', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markSolved('no-such-exercise'))
    expect(result.current.solved.size).toBe(0)
  })

  it('loads a version 1 payload that predates exercises', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, visited: ['complex-numbers'], completed: ['complex-numbers'] }),
    )
    const { result } = renderHook(() => useProgress())

    // Nothing is lost, and the missing field simply reads as "nothing solved yet".
    expect(result.current.completed.has('complex-numbers')).toBe(true)
    expect(result.current.solved.size).toBe(0)
  })

  it('drops a solved id that no longer exists', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 2, visited: [], completed: [], solved: ['renamed-away'] }),
    )
    const { result } = renderHook(() => useProgress())
    expect(result.current.solved.size).toBe(0)
  })
})

describe('statusOf', () => {
  it('labels each step for rendering', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.markComplete('complex-numbers'))
    act(() => result.current.markVisited('quantum-gates'))

    expect(statusOf(pathStepFor('complex-numbers')!, result.current)).toBe('complete')
    expect(statusOf(pathStepFor('vectors-and-matrices')!, result.current)).toBe('next')
    expect(statusOf(pathStepFor('quantum-gates')!, result.current)).toBe('visited')
    expect(statusOf(pathStepFor('shors-algorithm')!, result.current)).toBe('upcoming')
  })
})

// --- the path page ---------------------------------------------------------
//
// The ordered listing moved to /path when the landing page took over /. These tests follow it.

describe('the path page', () => {
  it('lists every step, in order, grouped by stage', () => {
    renderAt('/path')
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    for (const step of PATH) {
      expect(links).toContain(`/${step.trackId}/${step.slug}`)
    }
    expect(screen.getByText('Foundations')).toBeDefined()
    expect(screen.getByText('Synthesis')).toBeDefined()
  })

  it('offers the first step to a new reader', () => {
    renderAt('/path')
    expect(screen.getByText(/Start here/i)).toBeDefined()
    expect(screen.getByText('Not started')).toBeDefined()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('offers the next gap once some steps are done', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, visited: [], completed: ['complex-numbers', 'vectors-and-matrices'] }),
    )
    renderAt('/path')

    expect(screen.getByText(/Next up/i)).toBeDefined()
    expect(screen.getByText(`2 of ${PATH_LENGTH} complete`)).toBeDefined()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    // Dirac Notation is step 3, and appears both as the next-up card and in the list.
    expect(screen.getAllByText('Dirac Notation').length).toBeGreaterThan(0)
  })

  it('congratulates a reader who has finished', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, visited: [], completed: PATH.map((s) => s.slug) }),
    )
    renderAt('/path')
    expect(screen.getByText(/finished the path/i)).toBeDefined()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(PATH_LENGTH))
  })

  it('hides the reset control until there is something to reset', () => {
    renderAt('/path')
    expect(screen.queryByRole('button', { name: /reset progress/i })).toBeNull()
  })
})

// --- topic pages -----------------------------------------------------------

describe('a topic page on the path', () => {
  it('shows its step number and stage', () => {
    renderAt('/theory/quantum-gates')
    // Derived rather than hardcoded: the step number moves whenever the path is reordered, and a
    // frozen number would just be a chore to update rather than a real check.
    const step = pathStepFor('quantum-gates')!
    expect(screen.getByRole('link', { name: `step ${step.step}/${PATH_LENGTH}` })).toBeDefined()
    expect(screen.getByText(step.stage.title)).toBeDefined()
  })

  it('records the visit automatically', () => {
    renderAt('/math/complex-numbers')
    expect(stored().visited).toContain('complex-numbers')
    // But not as complete — that stays an explicit choice.
    expect(stored().completed ?? []).not.toContain('complex-numbers')
  })

  it('marks complete on demand and can be undone', () => {
    renderAt('/math/complex-numbers')

    fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
    expect(stored().completed).toContain('complex-numbers')
    expect(screen.getByText('Marked complete')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Mark unread' }))
    expect(stored().completed).not.toContain('complex-numbers')
  })

  it('links prev and next along the path, crossing tracks', () => {
    renderAt('/theory/measurement')
    // Step 7 → step 8 leaves the theory track for the algorithms track.
    const next = screen.getByRole('link', { name: /Quantum Random Numbers/ })
    expect(next).toHaveAttribute('href', '/algorithms/quantum-random-numbers')
  })

  it('sends the last step back to the path rather than nowhere', () => {
    renderAt('/algorithms/shors-algorithm')
    expect(screen.getByText(/Back to the path/i)).toBeDefined()
  })
})

// --- prerequisites ---------------------------------------------------------

describe('reading ahead', () => {
  it('warns when the groundwork is unread, without hiding the content', () => {
    renderAt('/algorithms/shors-algorithm')

    expect(screen.getByText(/Reading ahead/i)).toBeDefined()
    expect(screen.getByText(/which you haven’t read yet/i)).toBeDefined()
    // Crucially, the topic itself is still fully readable.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shor')
    expect(screen.getByRole('heading', { name: /Factoring Is Really Period Finding/i })).toBeDefined()
  })

  it('names the nearest unread steps rather than all of them', () => {
    renderAt('/algorithms/shors-algorithm')

    // 21 prerequisites, so it summarises rather than listing every one.
    expect(screen.getByText(/earlier steps, most recently/i)).toBeDefined()

    // Reached via its own heading rather than a role query: the Shor page renders a circuit SVG,
    // and Testing Library's role enumeration crashes on it inside jsdom. The section sidebar is
    // also an <aside>, so the first one in the document is the wrong one.
    const notice = screen.getByText(/Reading ahead/i).closest('aside')!
    const linked = [...notice.querySelectorAll('a')].map((a) => a.textContent)
    expect(linked).toEqual(['Grover’s Search', 'Quantum Fourier Transform', 'Quantum Phase Estimation'])
  })

  it('says nothing on the very first step', () => {
    renderAt('/math/complex-numbers')
    expect(screen.queryByText(/Reading ahead/i)).toBeNull()
  })

  it('disappears once the groundwork has been read', () => {
    // Complete exactly what Dirac Notation sits behind, whatever that currently is.
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        visited: [],
        completed: prerequisitesOf('dirac-notation').map((s) => s.slug),
      }),
    )
    renderAt('/theory/dirac-notation')
    expect(screen.queryByText(/Reading ahead/i)).toBeNull()
  })
})
