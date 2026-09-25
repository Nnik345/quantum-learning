/**
 * Exercises as the learner meets them: on the page, and on the board.
 *
 * The grading itself is covered in content/exercises.test.ts. What matters here is that an exercise
 * actually reaches the reader, accepts a right answer, refuses a wrong one, and remembers.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '../App'
import { PROGRESS_KEY } from './useProgress'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

beforeEach(() => window.localStorage.clear())

describe('an exercise on a lesson page', () => {
  it('renders where the content places it', () => {
    renderAt('/math/complex-numbers')
    expect(screen.getByText('Exercise')).toBeDefined()
    expect(screen.getByRole('button', { name: /check/i })).toBeDefined()
  })

  it('accepts the right answer and records it', () => {
    renderAt('/math/complex-numbers')
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByRole('status').textContent).toMatch(/correct/i)
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY)!).solved).toContain(
      'amplitude-to-probability',
    )
  })

  it('refuses a wrong answer without recording anything', () => {
    renderAt('/math/complex-numbers')
    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: '25' } })
    fireEvent.click(screen.getByRole('button', { name: /check/i }))

    expect(screen.getByRole('status').textContent).toMatch(/not quite/i)
    // Opening the page already recorded a visit, so the payload exists — but nothing is solved.
    expect(JSON.parse(window.localStorage.getItem(PROGRESS_KEY)!).solved).toEqual([])
  })

  it('asks for a number rather than grading empty input', () => {
    renderAt('/math/complex-numbers')
    fireEvent.click(screen.getByRole('button', { name: /check/i }))
    expect(screen.getByRole('status').textContent).toMatch(/enter a number/i)
  })

  it('shows a solved exercise as solved on a later visit', () => {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 2, visited: [], completed: [], solved: ['amplitude-to-probability'] }),
    )
    renderAt('/math/complex-numbers')
    expect(screen.getAllByText('solved').length).toBeGreaterThan(0)
  })

  it('hands circuit exercises off to the Lab rather than grading them inline', () => {
    renderAt('/algorithms/grovers-search')
    const open = screen.getByRole('link', { name: /open the broken circuit/i })
    expect(open).toHaveAttribute('href', '/circuit?exercise=fix-grover-oracle')
  })
})

describe('an exercise on the circuit board', () => {
  it('mounts the panel and loads the circuit to fix', () => {
    renderAt('/circuit?exercise=fix-grover-oracle')
    expect(screen.getByText('Exercise')).toBeDefined()
    expect(screen.getByRole('button', { name: /check my circuit/i })).toBeDefined()
    expect(screen.getByText(/Loaded the circuit to fix/i)).toBeDefined()
  })

  it('marks the preloaded broken circuit wrong, and says what it actually does', () => {
    renderAt('/circuit?exercise=fix-grover-oracle')
    fireEvent.click(screen.getByRole('button', { name: /check my circuit/i }))

    const status = screen.getByRole('status').textContent ?? ''
    expect(status).toMatch(/not yet/i)
    // The learner is told their own outcome, never the solution's gates.
    expect(status).toMatch(/25\.0%/)
  })

  it('offers a hint without giving the circuit away', () => {
    renderAt('/circuit?exercise=fix-grover-oracle')
    fireEvent.click(screen.getByRole('button', { name: /^hint$/i }))
    expect(screen.getByText(/symmetric/i)).toBeDefined()
  })

  it('shows no panel when no exercise is requested', () => {
    renderAt('/circuit')
    expect(screen.queryByRole('button', { name: /check my circuit/i })).toBeNull()
  })
})
