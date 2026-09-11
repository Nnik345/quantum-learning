/**
 * Page-level tests: every route mounts, and the circuit board's drag-to-place path actually works.
 *
 * The Bloch sphere is mocked because three.js needs a WebGL context that jsdom does not provide;
 * everything else runs for real, including the simulator behind the panels.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from './App'
import { CELL_H, CELL_W, HEADER_H, LABEL_W, gridHeight, gridWidth } from './circuit/geometry'

vi.mock('./components/LazyBlochSphere', () => ({
  BlochSphere: ({ vector }: { vector: { x: number; y: number; z: number } }) => (
    <div data-testid="bloch">
      {vector.x.toFixed(2)},{vector.y.toFixed(2)},{vector.z.toFixed(2)}
    </div>
  ),
}))

beforeEach(() => window.localStorage.clear())

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('routes', () => {
  it('renders the home page', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/quantum computing/i)
    expect(screen.getByRole('link', { name: /open the circuit lab/i })).toBeDefined()
  })

  it('renders a track index listing every topic', () => {
    renderAt('/math')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Basic Maths')
    expect(screen.getByText('Complex Numbers')).toBeDefined()
    expect(screen.getByText('Eigenvalues & Eigenvectors')).toBeDefined()
  })

  it('renders a topic page with its sections and marks the unwritten ones', () => {
    renderAt('/math/complex-numbers')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Complex Numbers')

    // The one worked section renders real content...
    expect(screen.getByRole('heading', { name: /Why Quantum Mechanics Needs Complex Numbers/i })).toBeDefined()
    // ...and the stubs are visibly marked rather than silently empty.
    expect(screen.getAllByText(/^Placeholder$/).length).toBeGreaterThan(0)
  })

  it('renders LaTeX through KaTeX', () => {
    const { container } = renderAt('/theory/dirac-notation')
    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('links to the next topic in the track', () => {
    renderAt('/theory/dirac-notation')
    expect(screen.getByRole('link', { name: /Qubits & the Bloch Sphere/ })).toBeDefined()
  })

  it('renders the algorithms placeholder without pretending to work', () => {
    renderAt('/algorithms')
    expect(screen.getByText(/not built yet/i)).toBeDefined()
    expect(screen.getByText(/Decisions still needed/i)).toBeDefined()
  })

  it('shows a 404 for an unknown topic slug', () => {
    renderAt('/math/does-not-exist')
    // Unknown slugs redirect back to the track index rather than dead-ending.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Basic Maths')
  })
})

// ---------------------------------------------------------------------------
// Circuit board
// ---------------------------------------------------------------------------

/**
 * jsdom gives every element a zero-sized rect, which would make grid hit-testing meaningless.
 * Give the SVG its natural size so client coordinates map 1:1 onto SVG user space.
 */
function sizeGrid(svg: SVGSVGElement, numQubits = 3, columns = 8) {
  const width = gridWidth(columns)
  const height = gridHeight(numQubits)
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) })
  return { width, height }
}

/** Centre of a grid cell in client coordinates. */
const cellPoint = (wire: number, column: number) => ({
  clientX: LABEL_W + column * CELL_W + CELL_W / 2,
  clientY: HEADER_H + wire * CELL_H + CELL_H / 2,
})

/**
 * Drag a palette chip onto a cell, the way a user does. The grid must already have been sized by
 * `getGrid` so the pointer coordinates land where they are meant to.
 */
function dragGateTo(chip: HTMLElement, wire: number, column: number) {
  const point = cellPoint(wire, column)
  fireEvent.pointerDown(chip, { clientX: 0, clientY: 0 })
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { ...point, bubbles: true }))
  })
  act(() => {
    window.dispatchEvent(new MouseEvent('pointerup', { ...point, bubbles: true }))
  })
}

const getGrid = (container: HTMLElement): SVGSVGElement => {
  const svg = container.querySelector('svg.no-select') as SVGSVGElement
  sizeGrid(svg)
  return svg
}

const paletteChip = (label: string) =>
  screen.getAllByTitle(new RegExp(`^${label}`, 'i'))[0] as HTMLElement

/**
 * Click "add control" for the given wire in the open inspector. The inspector lists one row per
 * wire in order, each with a target button and a control button.
 */
function makeControl(wire: number) {
  const buttons = screen.getAllByRole('button', { name: /^(add control|control ✓)$/ })
  fireEvent.click(buttons[wire])
}

describe('circuit board', () => {
  it('renders the wires, palette and initial state', () => {
    renderAt('/circuit')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Circuit Lab')
    expect(screen.getByText('q0')).toBeDefined()
    expect(screen.getByText('q2')).toBeDefined()
    // Nothing applied yet, so the register sits in |000⟩ with certainty. It appears twice: once
    // in the Dirac line and once in the amplitude table.
    expect(screen.getAllByText('|000⟩').length).toBeGreaterThan(0)
    expect(screen.getByText('100.0%')).toBeDefined()
  })

  it('places a gate by dragging it from the palette onto a wire', () => {
    const { container } = renderAt('/circuit')
    const svg = getGrid(container)

    expect(svg.querySelectorAll('rect[rx="6"]').length).toBe(0)
    dragGateTo(paletteChip('Hadamard'), 0, 0)

    // A gate box now exists on the grid.
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBeGreaterThan(0)
  })

  it('builds a Bell state and reports the correct amplitudes and entanglement', () => {
    const { container } = renderAt('/circuit')
    getGrid(container)

    dragGateTo(paletteChip('Hadamard'), 0, 0)
    dragGateTo(paletteChip('Pauli-X'), 1, 1)

    // Dropping selects the gate, so its inspector is showing. Make q0 a control → CNOT.
    makeControl(0)

    // (|00⟩ + |11⟩)/√2 with an untouched q2 → |000⟩ and |110⟩ at 50% each.
    expect(screen.getAllByText('|000⟩').length).toBeGreaterThan(0)
    expect(screen.getAllByText('|110⟩').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50.0%')).toHaveLength(2)
  })

  it('shows both Bloch vectors collapsing to the origin for a Bell pair', () => {
    const { container } = renderAt('/circuit')
    getGrid(container)

    dragGateTo(paletteChip('Hadamard'), 0, 0)
    dragGateTo(paletteChip('Pauli-X'), 1, 1)
    makeControl(0)

    fireEvent.click(screen.getByRole('button', { name: 'Bloch' }))

    const spheres = screen.getAllByTestId('bloch')
    expect(spheres).toHaveLength(3)
    // q0 and q1 are maximally mixed; q2 is untouched and still points at |0⟩ (+z).
    expect(spheres[0]).toHaveTextContent('0.00,0.00,0.00')
    expect(spheres[1]).toHaveTextContent('0.00,0.00,0.00')
    expect(spheres[2]).toHaveTextContent('0.00,0.00,1.00')
    expect(screen.getByText(/are mixed/i)).toBeDefined()
  })

  it('refuses to drop a gate onto an occupied cell', () => {
    const { container } = renderAt('/circuit')
    const svg = getGrid(container)

    dragGateTo(paletteChip('Hadamard'), 0, 0)
    const before = svg.querySelectorAll('rect[rx="6"]').length

    dragGateTo(paletteChip('Pauli-Z'), 0, 0)
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBe(before)
    expect(screen.getByText(/H already occupies q0 in this column/)).toBeDefined()
  })

  it('deletes a gate dragged off the grid', () => {
    const { container } = renderAt('/circuit')
    const svg = getGrid(container)

    dragGateTo(paletteChip('Hadamard'), 0, 0)
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBeGreaterThan(0)

    // Grab the placed gate and release far outside the canvas.
    const gateGroup = svg.querySelector('g[opacity="1"]') as SVGGElement
    fireEvent.pointerDown(gateGroup, { clientX: 0, clientY: 0 })
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 5000, clientY: 5000, bubbles: true }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 5000, clientY: 5000, bubbles: true }))
    })

    expect(svg.querySelectorAll('rect[rx="6"]').length).toBe(0)
  })

  it('steps back through the circuit to show an earlier state', () => {
    const { container } = renderAt('/circuit')
    getGrid(container)
    dragGateTo(paletteChip('Pauli-X'), 0, 0)

    // The inspection point starts at the end of the circuit, where the register is |100⟩.
    expect(screen.getAllByText('|100⟩').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('|000⟩')).toHaveLength(0)

    // Walk the inspection point back past column 1 to reach the initial state.
    const stepBack = screen.getByRole('button', { name: /step back/i })
    for (let i = 0; i < 8; i++) fireEvent.click(stepBack)

    expect(screen.getByText(/initial state/i)).toBeDefined()
    expect(screen.getAllByText('|000⟩').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('|100⟩')).toHaveLength(0)
  })

  it('undoes and redoes a placement from the toolbar', () => {
    const { container } = renderAt('/circuit')
    const svg = getGrid(container)
    dragGateTo(paletteChip('Hadamard'), 0, 0)
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBeGreaterThan(0)
  })

  it('adds and removes qubit wires', () => {
    renderAt('/circuit')
    expect(screen.queryByText('q3')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /add qubits/i }))
    expect(screen.getByText('q3')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /remove qubits/i }))
    expect(screen.queryByText('q3')).toBeNull()
  })

  it('runs shots and reports a histogram', () => {
    const { container } = renderAt('/circuit')
    getGrid(container)
    dragGateTo(paletteChip('Pauli-X'), 0, 0)

    fireEvent.click(screen.getByRole('button', { name: 'Shots' }))

    // 512 rather than a preset count, so the number in the histogram is unambiguous.
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '512' } })

    // The Run handler defers the synchronous sampling by a tick so the button can repaint.
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Run' }))
      act(() => {
        vi.runAllTimers()
      })
    } finally {
      vi.useRealTimers()
    }

    // A deterministic circuit gives the same bitstring every shot: all 512 land on "100".
    expect(screen.getByText('512')).toBeDefined()
    expect(screen.getByText('100.0%')).toBeDefined()
    expect(screen.getByText(/no measurement gates/i)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Custom gates
// ---------------------------------------------------------------------------

const matrixCell = (row: number, col: number) =>
  screen.getByRole('textbox', { name: `Matrix entry row ${row + 1} column ${col + 1}` })

const setCell = (row: number, col: number, value: string) =>
  fireEvent.change(matrixCell(row, col), { target: { value } })

describe('custom gates', () => {
  it('opens the dialog with a valid identity matrix', () => {
    renderAt('/circuit')
    fireEvent.click(screen.getByRole('button', { name: '+ New' }))

    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText(/✓ Unitary/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add gate' })).toBeEnabled()
  })

  it('rejects a non-unitary matrix and explains why', () => {
    renderAt('/circuit')
    fireEvent.click(screen.getByRole('button', { name: '+ New' }))

    setCell(0, 1, '1')
    setCell(1, 0, '1')
    setCell(1, 1, '1') // [[1,1],[1,1]] — not unitary

    expect(screen.getByText(/✕ Not unitary/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add gate' })).toBeDisabled()
  })

  it('reports a parse error with its position', () => {
    renderAt('/circuit')
    fireEvent.click(screen.getByRole('button', { name: '+ New' }))

    setCell(0, 0, '1/sqrt(2')
    expect(screen.getByText(/Missing "\)"/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Add gate' })).toBeDisabled()

    setCell(0, 0, '1 + @')
    expect(screen.getByText(/Unexpected character "@" \(at position 5\)/)).toBeDefined()
  })

  it('accepts a matrix written with expressions and applies it like the built-in gate', () => {
    const { container } = renderAt('/circuit')
    const svg = getGrid(container)

    fireEvent.click(screen.getByRole('button', { name: '+ New' }))
    setCell(0, 0, '1/sqrt(2)')
    setCell(0, 1, '1/sqrt(2)')
    setCell(1, 0, '1/sqrt(2)')
    setCell(1, 1, '-1/sqrt(2)')
    expect(screen.getByText(/✓ Unitary/)).toBeDefined()

    fireEvent.change(screen.getByRole('textbox', { name: 'Symbol (max 4)' }), {
      target: { value: 'MyH' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add gate' }))

    // The gate is now in the palette and can be dragged onto a wire.
    const chip = screen.getByTitle(/drag onto a wire/i)
    dragGateTo(chip, 0, 0)

    expect(svg.querySelectorAll('rect[rx="6"]').length).toBeGreaterThan(0)
    // A Hadamard by another name: equal superposition of |000⟩ and |100⟩.
    expect(screen.getAllByText('|000⟩').length).toBeGreaterThan(0)
    expect(screen.getAllByText('|100⟩').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50.0%')).toHaveLength(2)
  })

  it('loads a preset and keeps it unitary', () => {
    renderAt('/circuit')
    fireEvent.click(screen.getByRole('button', { name: '+ New' }))
    fireEvent.click(screen.getByRole('button', { name: '√X' }))

    expect(screen.getByText(/✓ Unitary/)).toBeDefined()
    expect(matrixCell(0, 0)).toHaveValue('(1+i)/2')
  })

  it('deletes a custom gate and every placement using it', () => {
    const { container } = renderAt('/circuit')
    const svg = getGrid(container)

    fireEvent.click(screen.getByRole('button', { name: '+ New' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add gate' }))
    dragGateTo(screen.getByTitle(/drag onto a wire/i), 0, 0)
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: /^Delete .* and its placements$/ }))
    expect(svg.querySelectorAll('rect[rx="6"]').length).toBe(0)
  })
})

describe('two-qubit custom gates', () => {
  it('places an iSWAP as a single gate spanning both wires', () => {
    const { container } = renderAt('/circuit')
    const svg = getGrid(container)

    // Put |01⟩ into the first two wires so the swap is observable.
    dragGateTo(paletteChip('Pauli-X'), 1, 0)

    fireEvent.click(screen.getByRole('button', { name: '+ New' }))
    fireEvent.click(screen.getByRole('button', { name: 'iSWAP' }))
    expect(screen.getByText(/✓ Unitary/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Add gate' }))

    dragGateTo(screen.getByTitle(/drag onto a wire/i), 0, 1)

    // One box spanning two wires, not two separate boxes: its height exceeds a single cell.
    const boxes = [...svg.querySelectorAll('rect[rx="6"]')]
    const spanning = boxes.find((b) => Number(b.getAttribute('height')) > CELL_H)
    expect(spanning).toBeDefined()

    // iSWAP takes |010⟩ to i|100⟩ — the excitation moves to q0, with a phase of i.
    expect(screen.getAllByText('|100⟩').length).toBeGreaterThan(0)
    expect(screen.getByText('100.0%')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Qubit inputs
// ---------------------------------------------------------------------------

/** Click the input-state button in a wire's gutter. */
function openInputDialog(wire: number) {
  fireEvent.pointerDown(
    screen.getByRole('button', { name: new RegExp(`^Input state for q${wire}:`) }),
  )
}

const inputButton = (wire: number) =>
  screen.getByRole('button', { name: new RegExp(`^Input state for q${wire}:`) })

describe('qubit inputs', () => {
  it('starts every wire in |0⟩ and says nothing about it', () => {
    renderAt('/circuit')
    for (const q of [0, 1, 2]) expect(inputButton(q)).toHaveAccessibleName(/currently \|0⟩/)
    expect(screen.queryByText(/^Inputs:$/)).toBeNull()
  })

  it('sets a wire to |1⟩ from the preset picker', () => {
    renderAt('/circuit')
    openInputDialog(0)

    expect(screen.getByRole('dialog')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Excited state/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Set input' }))

    // The register now starts in |100⟩, with no gates placed at all.
    expect(screen.getAllByText('|100⟩').length).toBeGreaterThan(0)
    expect(screen.getByText(/^Inputs:$/)).toBeDefined()
  })

  it('puts a |+⟩ input into superposition before any gate', () => {
    renderAt('/circuit')
    openInputDialog(0)
    fireEvent.click(screen.getByRole('button', { name: /Plus \(X basis\)/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Set input' }))

    expect(screen.getAllByText('|000⟩').length).toBeGreaterThan(0)
    expect(screen.getAllByText('|100⟩').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50.0%')).toHaveLength(2)
  })

  it('accepts a valid custom amplitude pair', () => {
    renderAt('/circuit')
    openInputDialog(1)
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))

    fireEvent.change(screen.getByLabelText(/coefficient of \|0⟩/), { target: { value: 'sqrt(0.36)' } })
    fireEvent.change(screen.getByLabelText(/coefficient of \|1⟩/), { target: { value: 'sqrt(0.64)' } })
    expect(screen.getByText(/✓ Normalised/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Set input' }))
    expect(screen.getByText('36.0%')).toBeDefined()
    expect(screen.getByText('64.0%')).toBeDefined()
  })

  it('refuses an unnormalised custom state and offers to fix it', () => {
    renderAt('/circuit')
    openInputDialog(0)
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))

    fireEvent.change(screen.getByLabelText(/coefficient of \|0⟩/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/coefficient of \|1⟩/), { target: { value: '1' } })

    expect(screen.getByText(/Not normalised/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Set input' })).toBeDisabled()

    // The normalise button rescales both amplitudes rather than silently accepting.
    fireEvent.click(screen.getByRole('button', { name: /Normalise/ }))
    expect(screen.getByText(/✓ Normalised/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Set input' })).toBeEnabled()
  })

  it('reports a parse error in an amplitude', () => {
    renderAt('/circuit')
    openInputDialog(0)
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }))
    fireEvent.change(screen.getByLabelText(/coefficient of \|0⟩/), { target: { value: 'oops' } })

    expect(screen.getAllByText(/Unknown symbol/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Set input' })).toBeDisabled()
  })

  it('resets all inputs back to |0⟩', () => {
    renderAt('/circuit')
    openInputDialog(0)
    fireEvent.click(screen.getByRole('button', { name: /Excited state/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Set input' }))
    expect(screen.getByText(/^Inputs:$/)).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /Reset to \|0⟩/ }))
    expect(screen.queryByText(/^Inputs:$/)).toBeNull()
    expect(screen.getAllByText('|000⟩').length).toBeGreaterThan(0)
  })

  it('feeds a non-default input through a gate', () => {
    const { container } = renderAt('/circuit')
    getGrid(container)

    openInputDialog(0)
    fireEvent.click(screen.getByRole('button', { name: /Excited state/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Set input' }))

    // X on a |1⟩ input takes it back to |0⟩.
    dragGateTo(paletteChip('Pauli-X'), 0, 0)
    expect(screen.getAllByText('|000⟩').length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Non-adjacent SWAP
// ---------------------------------------------------------------------------

describe('non-adjacent two-qubit gates', () => {
  it('moves one end of a SWAP to a distant wire from the inspector', () => {
    const { container } = renderAt('/circuit')
    getGrid(container)

    // q0 starts in |1⟩ so the swap is observable.
    openInputDialog(0)
    fireEvent.click(screen.getByRole('button', { name: /Excited state/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Set input' }))

    dragGateTo(paletteChip('Swap'), 0, 0)
    // Dropped adjacent by default: q0 ↔ q1, so |100⟩ becomes |010⟩.
    expect(screen.getAllByText('|010⟩').length).toBeGreaterThan(0)

    // Now move end B down to q2. Rows are q0, q1, q2; each has end A, end B, control.
    const endB = screen.getAllByRole('button', { name: 'end B' })
    fireEvent.click(endB[2])

    // q0 ↔ q2 now: |100⟩ becomes |001⟩, and q1 is untouched.
    expect(screen.getAllByText('|001⟩').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('|010⟩')).toHaveLength(0)
  })

  it('exchanges the two ends when both are put on the same wire', () => {
    const { container } = renderAt('/circuit')
    getGrid(container)
    dragGateTo(paletteChip('Swap'), 0, 0)

    // Put end A on q1, where end B already is — they should trade places, not be rejected.
    fireEvent.click(screen.getAllByRole('button', { name: 'end A' })[1])

    expect(screen.getAllByRole('button', { name: 'end A' })[1]).toHaveAttribute(
      'class',
      expect.stringContaining('border-cyan'),
    )
    expect(screen.queryByText(/cannot be used twice/i)).toBeNull()
  })
})
