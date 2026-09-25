import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  MAX_COLUMNS,
  MAX_QUBITS,
  MIN_COLUMNS,
  MIN_QUBITS,
  DEFAULT_INPUT,
  buildPlacement,
  checkPlacement,
  gateDef,
  hasDefaultInputs,
  inputKet,
  movePlacementTo,
  type Placement,
} from '../lib/quantum/circuit'
import { simulate, stepCount } from '../lib/quantum/simulate'
import { circuitToJson, deserialiseCircuit } from '../lib/quantum/persist'
import { getPreset } from '../lib/quantum/presets'
import { publishCircuit, unpublishCircuit, takePendingCircuit } from './circuitBridge'
import type { CustomGate } from '../lib/quantum/gates'

import { CircuitGrid } from './CircuitGrid'
import { GatePalette } from './GatePalette'
import { GateInspector } from './GateInspector'
import { StatePanel } from './StatePanel'
import { ProbabilityChart } from './ProbabilityChart'
import { BlochPanel } from './BlochPanel'
import { ShotsPanel } from './ShotsPanel'
import { CustomGateDialog } from './CustomGateDialog'
import { QubitInputDialog } from './QubitInputDialog'
import { useCircuitStore } from './useCircuitStore'
import { cellFromPoint, toSvgPoint } from './geometry'
import type { DragState, Pointer } from './dragTypes'

type Tab = 'state' | 'probabilities' | 'bloch' | 'shots'

const TABS: { id: Tab; label: string }[] = [
  { id: 'state', label: 'State' },
  { id: 'probabilities', label: 'Probabilities' },
  { id: 'bloch', label: 'Bloch' },
  { id: 'shots', label: 'Shots' },
]

export function CircuitBoard() {
  const store = useCircuitStore()
  const { circuit } = store

  const [searchParams, setSearchParams] = useSearchParams()
  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [tab, setTab] = useState<Tab>('state')
  const [inspectStep, setInspectStep] = useState(circuit.columns)
  const [playing, setPlaying] = useState(false)
  const [dialog, setDialog] = useState<{ open: boolean; editKey?: string }>({ open: false })
  /** Wire whose input-state picker is open, if any. */
  const [inputWire, setInputWire] = useState<number | undefined>()

  const [drag, setDrag] = useState<DragState | null>(null)
  const [pointer, setPointer] = useState<Pointer>({ x: 0, y: 0 })
  const [hover, setHover] = useState<{ wire: number; column: number; valid: boolean } | null>(null)

  const simulation = useMemo(() => simulate(circuit), [circuit])
  const maxStep = circuit.columns
  const clampedStep = Math.min(inspectStep, simulation.states.length - 1)
  const displayState = simulation.states[clampedStep]
  const selected = circuit.placements.find((p) => p.id === selectedId)

  // Keep the inspection point valid when the grid shrinks.
  useEffect(() => {
    setInspectStep((s) => Math.min(s, circuit.columns))
  }, [circuit.columns])

  // Let the assistant read the board, and collect any circuit it parked while we were unmounted.
  useEffect(() => {
    publishCircuit(circuit, (next) =>
      store.replaceCircuit(next, 'Loaded the tutor\u2019s circuit. Undo restores your own.'),
    )
    return unpublishCircuit
  }, [circuit, store])

  useEffect(() => {
    const parked = takePendingCircuit()
    if (!parked) return
    store.replaceCircuit(parked, 'Loaded the tutor\u2019s circuit. Undo restores your own.')
    setInspectStep(parked.columns)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- collect once on mount
  }, [])

  /**
   * Load a worked circuit arriving as ?preset=<id> from a lesson page.
   *
   * This overwrites whatever was on the board, so it goes through the normal undoable commit and
   * says so — one Ctrl+Z brings the previous circuit back. The query parameter is then cleared so
   * a later reload does not silently replace the reader's own edits with the preset again.
   */
  const presetId = searchParams.get('preset')
  useEffect(() => {
    if (!presetId) return
    const found = getPreset(presetId)
    setSearchParams({}, { replace: true })
    if (!found) return
    store.replaceCircuit(found.circuit, `Loaded “${found.name}”. Undo restores your own circuit.`)
    setSelectedId(undefined)
    setInspectStep(found.circuit.columns)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when the parameter changes
  }, [presetId])

  // ---------------------------------------------------------------- dragging

  /**
   * Whether dropping the current drag on `cell` would be accepted. Uses the same helpers the
   * store uses to commit, so the ghost preview and the real placement always agree.
   */
  const validateDrop = useCallback(
    (state: DragState, wire: number, column: number): boolean => {
      if (state.kind === 'new') {
        const candidate = buildPlacement(circuit, state.gateId, wire, column, 'preview')
        return candidate ? checkPlacement(circuit, candidate).ok : false
      }
      if (state.kind === 'move') {
        const existing = circuit.placements.find((p) => p.id === state.id)
        if (!existing) return false
        const moved = movePlacementTo(circuit, existing, wire, column)
        return moved ? checkPlacement(circuit, moved, state.id).ok : false
      }
      // control: must land on the gate's own column, on a wire that isn't already a target
      const existing = circuit.placements.find((p) => p.id === state.id)
      if (!existing || existing.column !== column) return false
      if (existing.targets.includes(wire)) return false
      const controls = existing.controls.includes(wire)
        ? existing.controls.filter((c) => c !== wire)
        : [...existing.controls, wire]
      return checkPlacement(circuit, { ...existing, controls }, state.id).ok
    },
    [circuit],
  )

  useEffect(() => {
    if (!drag) return

    const locate = (e: PointerEvent) => {
      const svg = svgRef.current
      if (!svg) return null
      const { x, y } = toSvgPoint(svg, e.clientX, e.clientY)
      return cellFromPoint(x, y, circuit.numQubits, circuit.columns)
    }

    const onMove = (e: PointerEvent) => {
      e.preventDefault()
      setPointer({ x: e.clientX, y: e.clientY })
      const cell = locate(e)
      setHover(cell ? { ...cell, valid: validateDrop(drag, cell.wire, cell.column) } : null)
    }

    const onUp = (e: PointerEvent) => {
      const cell = locate(e)

      if (!cell) {
        // Dropped outside the grid: moving a gate off the board deletes it.
        if (drag.kind === 'move') store.removeGate(drag.id)
      } else if (drag.kind === 'new') {
        const id = store.addGate(drag.gateId, cell.wire, cell.column)
        if (id) setSelectedId(id)
      } else if (drag.kind === 'move') {
        store.moveGate(drag.id, cell.wire, cell.column)
      } else {
        store.toggleControl(drag.id, cell.wire)
      }
      // The store re-validates and reports the reason on rejection, so an illegal drop explains
      // itself rather than silently doing nothing. `validateDrop` only drives the ghost preview.

      setDrag(null)
      setHover(null)
    }

    const onCancel = () => {
      setDrag(null)
      setHover(null)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [drag, circuit.numQubits, circuit.columns, validateDrop, store])

  const startPaletteDrag = (e: React.PointerEvent, gateId: string, label: string) => {
    e.preventDefault()
    setPointer({ x: e.clientX, y: e.clientY })
    setDrag({ kind: 'new', gateId, label })
  }

  const startGateDrag = (e: React.PointerEvent, placement: Placement) => {
    e.preventDefault()
    setPointer({ x: e.clientX, y: e.clientY })
    setDrag({
      kind: 'move',
      id: placement.id,
      label: gateDef(circuit, placement.gate)?.label ?? '?',
    })
  }

  const startControlDrag = (e: React.PointerEvent, placement: Placement) => {
    e.preventDefault()
    setPointer({ x: e.clientX, y: e.clientY })
    setDrag({ kind: 'control', id: placement.id, label: '•' })
  }

  // ---------------------------------------------------------------- keyboard

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        store.removeGate(selectedId)
        setSelectedId(undefined)
        return
      }
      if (e.key === 'Escape') {
        setSelectedId(undefined)
        setDrag(null)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        store.redo()
        return
      }
      if (e.key === 'ArrowLeft') setInspectStep((s) => Math.max(0, s - 1))
      if (e.key === 'ArrowRight') setInspectStep((s) => Math.min(maxStep, s + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, store, maxStep])

  // ---------------------------------------------------------------- playback

  useEffect(() => {
    if (!playing) return
    const end = Math.max(1, stepCount(circuit))
    const timer = setInterval(() => {
      setInspectStep((s) => {
        if (s >= end) {
          setPlaying(false)
          return s
        }
        return s + 1
      })
    }, 620)
    return () => clearInterval(timer)
  }, [playing, circuit])

  // ------------------------------------------------------------ import/export

  const exportJson = () => {
    const blob = new Blob([circuitToJson(circuit)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'circuit.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    try {
      const { circuit: loaded, warnings } = deserialiseCircuit(JSON.parse(await file.text()))
      store.replaceCircuit(loaded, warnings.length > 0 ? warnings.join(' · ') : undefined)
      setSelectedId(undefined)
      setInspectStep(loaded.columns)
    } catch {
      store.replaceCircuit(circuit, 'That file could not be read as a circuit.')
    }
  }

  const saveCustomGate = (gate: CustomGate) => {
    store.addCustomGate(gate)
    setDialog({ open: false })
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Circuit Lab</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-dim">
          Drag gates onto the wires. The panels update live, showing the state after the column
          marked by the dashed line — click any column number to inspect that point.
        </p>
      </header>

      {store.notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 text-xs text-amber">
          <span>{store.notice}</span>
          <button onClick={store.dismissNotice} className="shrink-0 hover:text-ink">
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)_360px]">
        {/* Palette */}
        <aside className="card order-1 p-3.5 xl:order-none">
          <GatePalette
            circuit={circuit}
            onDragStart={startPaletteDrag}
            onOpenCustomDialog={() => setDialog({ open: true })}
            onEditCustom={(key) => setDialog({ open: true, editKey: key })}
            onDeleteCustom={(key) => store.removeCustomGate(key)}
          />
        </aside>

        {/* Canvas */}
        <section className="order-2 min-w-0 xl:order-none">
          <Toolbar
            store={store}
            inspectStep={clampedStep}
            maxStep={maxStep}
            playing={playing}
            onStep={setInspectStep}
            onTogglePlay={() => {
              if (!playing && clampedStep >= stepCount(circuit)) setInspectStep(0)
              setPlaying((p) => !p)
            }}
            onExport={exportJson}
            onImport={() => fileRef.current?.click()}
          />

          <div className="card mt-3 overflow-x-auto p-3">
            <CircuitGrid
              ref={svgRef}
              circuit={circuit}
              selectedId={selectedId}
              drag={drag}
              hover={hover}
              inspectStep={clampedStep}
              onSelect={setSelectedId}
              onInspectStep={setInspectStep}
              onGatePointerDown={startGateDrag}
              onControlHandlePointerDown={startControlDrag}
              onBackgroundPointerDown={() => setSelectedId(undefined)}
              onEditInput={setInputWire}
            />
          </div>

          <p className="mt-2 text-[11px] leading-5 text-ink-faint">
            <span className="text-ink-dim">q0 is the top wire and the leftmost symbol in a ket</span>{' '}
            — |q0 q1 …⟩, the textbook convention. Qiskit prints bitstrings the other way round.
            Delete removes the selected gate; Ctrl+Z undoes; ←/→ step through the circuit.
          </p>

          {simulation.errors.length > 0 && (
            <div className="mt-3 rounded-lg border border-rose/40 bg-rose/5 px-3 py-2 text-xs text-rose">
              {simulation.errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

        </section>

        {/* Analysis */}
        <aside className="order-3 min-w-0 space-y-3 xl:order-none">
          {/* Rendered once only: on narrow screens this column stacks directly under the canvas,
              which is where the inspector belongs anyway. */}
          {selected && (
            <div className="card p-4">
              <GateInspector
                circuit={circuit}
                placement={selected}
                store={store}
                onClose={() => setSelectedId(undefined)}
              />
            </div>
          )}

          <div className="card p-4">
            <div className="mb-3 flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={[
                    'rounded-md px-2.5 py-1 text-xs transition-colors',
                    tab === t.id
                      ? 'bg-surface-2 text-cyan'
                      : 'text-ink-faint hover:bg-surface-2/60 hover:text-ink',
                  ].join(' ')}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mb-3 flex items-center justify-between text-[11px] text-ink-faint">
              <span>
                {clampedStep === 0
                  ? 'Initial state, before any gate'
                  : `State after column ${clampedStep}`}
              </span>
              <span className="font-mono">
                {circuit.numQubits} qubit{circuit.numQubits > 1 ? 's' : ''}
              </span>
            </div>

            {/* A non-|0⟩ input changes every number below, so it must not be easy to miss. */}
            {!hasDefaultInputs(circuit) && (
              <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-r border-l-2 border-l-cyan bg-surface/60 px-2.5 py-1.5 text-[11px] text-ink-dim">
                <span>Inputs:</span>
                <span className="font-mono text-cyan">
                  {circuit.inputs
                    .map((input, q) => `q${q}=${inputKet(input)}`)
                    .join('  ')}
                </span>
                <button
                  onClick={store.resetInputs}
                  className="ml-auto rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-cyan hover:text-cyan"
                >
                  Reset to |0⟩
                </button>
              </div>
            )}

            {simulation.hasMeasurement && tab !== 'shots' && (
              <p className="mb-3 rounded-r border-l-2 border-l-amber bg-surface/60 px-2.5 py-1.5 text-[11px] leading-5 text-ink-dim">
                This circuit contains a measurement. The state below is the{' '}
                <span className="text-amber">pre-measurement</span> state — measurement gates are not
                collapsed here. Use the Shots tab for sampled results.
              </p>
            )}

            {tab === 'state' && <StatePanel state={displayState} />}
            {tab === 'probabilities' && <ProbabilityChart state={displayState} />}
            {tab === 'bloch' && <BlochPanel state={displayState} />}
            {tab === 'shots' && <ShotsPanel circuit={circuit} />}
          </div>
        </aside>
      </div>

      {/* Floating ghost follows the pointer during a drag. */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50 flex size-9 items-center justify-center rounded-md border border-cyan bg-surface-2 font-mono text-sm text-cyan shadow-lg"
          style={{ left: pointer.x - 18, top: pointer.y - 18 }}
        >
          {drag.label}
        </div>
      )}

      {store.lastError && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-rose/50 bg-surface px-4 py-2 text-xs text-rose shadow-xl">
          {store.lastError}
        </div>
      )}

      {inputWire !== undefined && (
        <QubitInputDialog
          wire={inputWire}
          input={circuit.inputs[inputWire] ?? DEFAULT_INPUT}
          onSave={(input) => store.setQubitInput(inputWire, input)}
          onClose={() => setInputWire(undefined)}
        />
      )}

      {dialog.open && (
        <CustomGateDialog
          existing={dialog.editKey ? circuit.customGates[dialog.editKey] : undefined}
          takenIds={Object.keys(circuit.customGates)}
          onSave={saveCustomGate}
          onClose={() => setDialog({ open: false })}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void importJson(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Toolbar({
  store,
  inspectStep,
  maxStep,
  playing,
  onStep,
  onTogglePlay,
  onExport,
  onImport,
}: {
  store: ReturnType<typeof useCircuitStore>
  inspectStep: number
  maxStep: number
  playing: boolean
  onStep: (n: number) => void
  onTogglePlay: () => void
  onExport: () => void
  onImport: () => void
}) {
  const { circuit } = store

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2">
      <Stepper
        label="Qubits"
        value={circuit.numQubits}
        min={MIN_QUBITS}
        max={MAX_QUBITS}
        onChange={store.setNumQubits}
      />
      <Stepper
        label="Columns"
        value={circuit.columns}
        min={MIN_COLUMNS}
        max={MAX_COLUMNS}
        onChange={store.setColumns}
      />

      <div className="flex items-center gap-1">
        <span className="mr-1 text-[10px] uppercase tracking-wider text-ink-faint">Step</span>
        <IconButton label="Step back" onClick={() => onStep(Math.max(0, inspectStep - 1))}>
          ◀
        </IconButton>
        <IconButton label={playing ? 'Pause' : 'Play'} onClick={onTogglePlay}>
          {playing ? '❙❙' : '▶'}
        </IconButton>
        <IconButton label="Step forward" onClick={() => onStep(Math.min(maxStep, inspectStep + 1))}>
          ▶❙
        </IconButton>
        <span className="ml-1 w-10 font-mono text-[11px] text-ink-faint">
          {inspectStep}/{maxStep}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <IconButton label="Undo" onClick={store.undo} disabled={!store.canUndo}>
          ↶
        </IconButton>
        <IconButton label="Redo" onClick={store.redo} disabled={!store.canRedo}>
          ↷
        </IconButton>
        <TextButton onClick={store.clear}>Clear</TextButton>
        <TextButton onClick={onImport}>Import</TextButton>
        <TextButton onClick={onExport}>Export</TextButton>
      </div>
    </div>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <IconButton label={`Remove ${label}`} onClick={() => onChange(value - 1)} disabled={value <= min}>
        −
      </IconButton>
      <span className="w-5 text-center font-mono text-xs text-ink">{value}</span>
      <IconButton label={`Add ${label}`} onClick={() => onChange(value + 1)} disabled={value >= max}>
        +
      </IconButton>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-6 items-center justify-center rounded border border-line text-[11px] text-ink-dim transition-colors hover:border-cyan hover:text-cyan disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-line disabled:hover:text-ink-dim"
    >
      {children}
    </button>
  )
}

function TextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-dim transition-colors hover:border-cyan hover:text-cyan"
    >
      {children}
    </button>
  )
}
