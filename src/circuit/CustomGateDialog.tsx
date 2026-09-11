/**
 * Define a gate by typing its matrix.
 *
 * Cells are parsed as complex expressions and the result is checked against U†U = I before the
 * gate can be saved — a non-unitary matrix would break normalisation and every probability
 * downstream, so it is refused rather than accepted with a warning.
 */

import { useEffect, useMemo, useState } from 'react'

import { format, type Complex } from '../lib/quantum/complex'
import { isUnitary } from '../lib/quantum/matrix'
import { parseCell } from '../lib/quantum/parseComplex'
import type { CustomGate } from '../lib/quantum/gates'

const PRESETS: { name: string; arity: number; cells: string[][] }[] = [
  {
    name: 'Hadamard',
    arity: 1,
    cells: [
      ['1/sqrt(2)', '1/sqrt(2)'],
      ['1/sqrt(2)', '-1/sqrt(2)'],
    ],
  },
  {
    name: '√X',
    arity: 1,
    cells: [
      ['(1+i)/2', '(1-i)/2'],
      ['(1-i)/2', '(1+i)/2'],
    ],
  },
  {
    name: 'iSWAP',
    arity: 2,
    cells: [
      ['1', '0', '0', '0'],
      ['0', '0', 'i', '0'],
      ['0', 'i', '0', '0'],
      ['0', '0', '0', '1'],
    ],
  },
]

const emptyCells = (size: number): string[][] =>
  Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, col) => (r === col ? '1' : '0')),
  )

export function CustomGateDialog({
  existing,
  takenIds,
  onSave,
  onClose,
}: {
  existing?: CustomGate
  takenIds: string[]
  onSave: (gate: CustomGate) => void
  onClose: () => void
}) {
  const [arity, setArity] = useState(existing?.arity ?? 1)
  const [label, setLabel] = useState(existing?.label ?? 'U')
  const [name, setName] = useState(existing?.name ?? 'My gate')
  const [cells, setCells] = useState<string[][]>(existing?.source ?? emptyCells(2))

  const size = 1 << arity

  // Resize the grid when the qubit count changes, keeping any values that still fit.
  useEffect(() => {
    setCells((prev) => {
      if (prev.length === size) return prev
      const next = emptyCells(size)
      for (let r = 0; r < Math.min(prev.length, size); r++) {
        for (let col = 0; col < Math.min(prev[r].length, size); col++) next[r][col] = prev[r][col]
      }
      return next
    })
  }, [size])

  const parsed = useMemo(() => {
    const values: Complex[][] = []
    const errors: (string | undefined)[][] = []
    for (let r = 0; r < cells.length; r++) {
      const valueRow: Complex[] = []
      const errorRow: (string | undefined)[] = []
      for (let col = 0; col < cells[r].length; col++) {
        const result = parseCell(cells[r][col])
        valueRow.push(result.value ?? { re: 0, im: 0 })
        errorRow.push(result.error)
      }
      values.push(valueRow)
      errors.push(errorRow)
    }
    return { values, errors, hasError: errors.some((row) => row.some(Boolean)) }
  }, [cells])

  const unitarity = useMemo(
    () => (parsed.hasError ? undefined : isUnitary(parsed.values)),
    [parsed],
  )

  const id = useMemo(() => {
    if (existing) return existing.id
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gate'
    let candidate = base
    let n = 2
    while (takenIds.includes(candidate)) candidate = `${base}-${n++}`
    return candidate
  }, [existing, name, takenIds])

  const firstError = parsed.errors.flat().find(Boolean)
  const canSave = !parsed.hasError && unitarity?.ok === true && label.trim() !== ''

  const save = () => {
    if (!canSave) return
    onSave({
      id,
      label: label.trim().slice(0, 4),
      name: name.trim() || 'Custom gate',
      arity,
      source: cells.map((row) => row.map((c) => c.trim() || '0')),
      matrix: parsed.values,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-gate-title"
        className="my-8 w-full max-w-2xl rounded-xl border border-line bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="custom-gate-title" className="text-base font-semibold text-ink">
              {existing ? 'Edit custom gate' : 'New custom gate'}
            </h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              Entries accept expressions:{' '}
              <span className="font-mono text-ink-dim">1/sqrt(2)</span>,{' '}
              <span className="font-mono text-ink-dim">e^(i*pi/4)</span>,{' '}
              <span className="font-mono text-ink-dim">-i</span>,{' '}
              <span className="font-mono text-ink-dim">(1+i)/2</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded border border-line px-2 py-0.5 text-sm text-ink-faint hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-line bg-ground px-2 py-1.5 text-sm text-ink outline-none focus:border-cyan"
            />
          </Field>
          <Field label="Symbol (max 4)">
            <input
              value={label}
              maxLength={4}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border border-line bg-ground px-2 py-1.5 font-mono text-sm text-ink outline-none focus:border-cyan"
            />
          </Field>
          <Field label="Qubits">
            <div className="flex gap-1.5">
              {[1, 2].map((a) => (
                <button
                  key={a}
                  onClick={() => setArity(a)}
                  className={[
                    'flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors',
                    arity === a
                      ? 'border-cyan bg-cyan/10 text-cyan'
                      : 'border-line text-ink-dim hover:text-ink',
                  ].join(' ')}
                >
                  {a}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* Matrix grid, wrapped in braces so it reads as a matrix rather than a form. */}
        <div className="mb-3 flex items-stretch gap-2 overflow-x-auto py-1">
          <Brace side="left" />
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(84px, 1fr))` }}
          >
            {cells.map((row, r) =>
              row.map((value, col) => (
                <input
                  key={`${r}-${col}`}
                  value={value}
                  aria-label={`Matrix entry row ${r + 1} column ${col + 1}`}
                  aria-invalid={Boolean(parsed.errors[r]?.[col])}
                  spellCheck={false}
                  onChange={(e) =>
                    setCells((prev) =>
                      prev.map((pr, ri) =>
                        ri === r ? pr.map((pc, ci) => (ci === col ? e.target.value : pc)) : pr,
                      ),
                    )
                  }
                  className={[
                    'w-full rounded-md border bg-ground px-2 py-1.5 text-center font-mono text-xs outline-none',
                    parsed.errors[r]?.[col]
                      ? 'border-rose text-rose'
                      : 'border-line text-ink focus:border-cyan',
                  ].join(' ')}
                />
              )),
            )}
          </div>
          <Brace side="right" />
        </div>

        {/* Numeric echo, so an expression's actual value is visible. */}
        {!parsed.hasError && (
          <div className="mb-3 overflow-x-auto rounded-lg border border-line bg-ground/60 p-2.5">
            <div
              className="grid gap-x-4 gap-y-0.5 font-mono text-[11px] text-ink-dim"
              style={{ gridTemplateColumns: `repeat(${size}, auto)`, width: 'fit-content' }}
            >
              {parsed.values.map((row, r) =>
                row.map((v, col) => (
                  <span key={`${r}-${col}`} className="text-right">
                    {format(v, 4)}
                  </span>
                )),
              )}
            </div>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">Presets</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => {
                setArity(preset.arity)
                setCells(preset.cells.map((r) => [...r]))
                setName(preset.name)
                setLabel(preset.name.slice(0, 4))
              }}
              className="rounded border border-line px-2 py-0.5 font-mono text-[11px] text-ink-dim transition-colors hover:border-cyan hover:text-cyan"
            >
              {preset.name}
            </button>
          ))}
        </div>

        <StatusLine error={firstError} unitarity={unitarity} />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-line px-4 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="rounded-md border border-cyan bg-cyan/10 px-4 py-1.5 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {existing ? 'Save changes' : 'Add gate'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusLine({
  error,
  unitarity,
}: {
  error?: string
  unitarity?: { ok: boolean; maxDeviation: number }
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-rose/40 bg-rose/5 px-3 py-2 text-xs text-rose">
        {error}
      </div>
    )
  }
  if (!unitarity) return null

  if (unitarity.ok) {
    return (
      <div className="rounded-lg border border-emerald/40 bg-emerald/5 px-3 py-2 text-xs text-emerald">
        ✓ Unitary — U†U = I to within {unitarity.maxDeviation.toExponential(1)}.
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-rose/40 bg-rose/5 px-3 py-2 text-xs text-rose">
      ✕ Not unitary. U†U differs from the identity by up to{' '}
      {unitarity.maxDeviation.toExponential(2)}. Every quantum gate must be reversible and
      norm-preserving, so this matrix cannot be used.
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      {children}
    </label>
  )
}

function Brace({ side }: { side: 'left' | 'right' }) {
  return (
    <svg width="10" className="shrink-0 text-line-bright" viewBox="0 0 10 100" preserveAspectRatio="none">
      <path
        d={side === 'left' ? 'M9 1 L2 1 L2 99 L9 99' : 'M1 1 L8 1 L8 99 L1 99'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
