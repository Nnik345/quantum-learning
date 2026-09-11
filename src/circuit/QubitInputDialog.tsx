/**
 * Choose what state a wire starts in.
 *
 * Presets cover the six cardinal states; a custom input takes the two amplitudes directly and is
 * refused unless |α|² + |β|² = 1, because an unnormalised input silently corrupts every
 * probability downstream.
 *
 * A clearly-wrong input is rejected with a "Normalise" button rather than being rescaled behind
 * the user's back — changing what they typed without saying so would be worse than refusing it.
 * Residual rounding within tolerance (typing `0.707107` for 1/√2) is accepted and scaled to exact
 * unit norm inside `resolveInput`, so the simulation is always numerically exact.
 */

import { useMemo, useState } from 'react'

import {
  INPUT_PRESETS,
  NORM_TOLERANCE,
  resolveInput,
  type QubitInput,
} from '../lib/quantum/circuit'
import { abs2, format, arg, type Complex } from '../lib/quantum/complex'
import { parseCell } from '../lib/quantum/parseComplex'
import { Tex } from '../components/Tex'

interface Props {
  wire: number
  input: QubitInput
  onSave: (input: QubitInput) => void
  onClose: () => void
}

export function QubitInputDialog({ wire, input, onSave, onClose }: Props) {
  const [mode, setMode] = useState<'preset' | 'custom'>(input.preset === 'custom' ? 'custom' : 'preset')
  const [presetId, setPresetId] = useState(input.preset === 'custom' ? '0' : input.preset)
  const [source, setSource] = useState<[string, string]>(input.source ?? ['1/sqrt(2)', '1/sqrt(2)'])

  const alpha = parseCell(source[0])
  const beta = parseCell(source[1])
  const parseError = alpha.error ?? beta.error

  const norm = useMemo(
    () => (alpha.value && beta.value ? abs2(alpha.value) + abs2(beta.value) : NaN),
    [alpha.value, beta.value],
  )
  const normalised = Number.isFinite(norm) && Math.abs(norm - 1) <= NORM_TOLERANCE

  const candidate: QubitInput =
    mode === 'custom' ? { preset: 'custom', source } : { preset: presetId as QubitInput['preset'] }

  const resolution = resolveInput(candidate)
  const canSave = !resolution.error

  const normalise = () => {
    if (!alpha.value || !beta.value || !Number.isFinite(norm) || norm <= 0) return
    const s = 1 / Math.sqrt(norm)
    setSource([format(scale(alpha.value, s), 10), format(scale(beta.value, s), 10)])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qubit-input-title"
        className="my-8 w-full max-w-lg rounded-xl border border-line bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="qubit-input-title" className="text-base font-semibold text-ink">
              Input state for <span className="font-mono text-cyan">q{wire}</span>
            </h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              The state this wire starts in, before any gate is applied.
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

        <div className="mb-4 flex gap-1.5">
          {(['preset', 'custom'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                'flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors',
                mode === m
                  ? 'border-cyan bg-cyan/10 text-cyan'
                  : 'border-line text-ink-dim hover:text-ink',
              ].join(' ')}
            >
              {m === 'preset' ? 'Standard states' : 'Custom'}
            </button>
          ))}
        </div>

        {mode === 'preset' ? (
          <div className="grid grid-cols-3 gap-2">
            {INPUT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setPresetId(preset.id)}
                aria-pressed={presetId === preset.id}
                className={[
                  'rounded-lg border px-2 py-3 transition-colors',
                  presetId === preset.id
                    ? 'border-cyan bg-cyan/10'
                    : 'border-line hover:border-line-bright',
                ].join(' ')}
              >
                <div
                  className={`font-mono text-lg ${presetId === preset.id ? 'text-cyan' : 'text-ink'}`}
                >
                  {preset.ket}
                </div>
                <div className="mt-0.5 text-[10px] leading-tight text-ink-faint">{preset.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-ink-dim">
              <Tex tex="|\psi\rangle = \alpha|0\rangle + \beta|1\rangle" /> — expressions such as{' '}
              <span className="font-mono text-ink">1/sqrt(2)</span> and{' '}
              <span className="font-mono text-ink">e^(i*pi/3)/sqrt(2)</span> are accepted.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <AmplitudeField
                label="α  (coefficient of |0⟩)"
                value={source[0]}
                error={alpha.error}
                onChange={(v) => setSource([v, source[1]])}
              />
              <AmplitudeField
                label="β  (coefficient of |1⟩)"
                value={source[1]}
                error={beta.error}
                onChange={(v) => setSource([source[0], v])}
              />
            </div>

            {!parseError && alpha.value && beta.value && (
              <Readout alpha={alpha.value} beta={beta.value} norm={norm} />
            )}

            {!parseError && !normalised && Number.isFinite(norm) && norm > 0 && (
              <button
                onClick={normalise}
                className="w-full rounded-md border border-amber/50 px-3 py-1.5 text-xs text-amber transition-colors hover:bg-amber/10"
              >
                Normalise — divide both by √{norm.toFixed(4)}
              </button>
            )}
          </div>
        )}

        {resolution.error && (
          <div className="mt-4 rounded-lg border border-rose/40 bg-rose/5 px-3 py-2 text-xs text-rose">
            {resolution.error}
          </div>
        )}
        {mode === 'custom' && !resolution.error && (
          <div className="mt-4 rounded-lg border border-emerald/40 bg-emerald/5 px-3 py-2 text-xs text-emerald">
            ✓ Normalised — |α|² + |β|² = 1.
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-line px-4 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!canSave) return
              onSave(candidate)
              onClose()
            }}
            disabled={!canSave}
            className="rounded-md border border-cyan bg-cyan/10 px-4 py-1.5 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Set input
          </button>
        </div>
      </div>
    </div>
  )
}

const scale = (z: Complex, s: number): Complex => ({ re: z.re * s, im: z.im * s })

function AmplitudeField({
  label,
  value,
  error,
  onChange,
}: {
  label: string
  value: string
  error?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">{label}</span>
      <input
        value={value}
        spellCheck={false}
        aria-label={label}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'w-full rounded-md border bg-ground px-2 py-1.5 font-mono text-sm outline-none',
          error ? 'border-rose text-rose' : 'border-line text-ink focus:border-cyan',
        ].join(' ')}
      />
      {error && <span className="mt-1 block text-[10px] text-rose">{error}</span>}
    </label>
  )
}

/** Numeric echo plus the measurement probabilities the state implies. */
function Readout({ alpha, beta, norm }: { alpha: Complex; beta: Complex; norm: number }) {
  const p0 = abs2(alpha)
  const p1 = abs2(beta)
  const relativePhase = arg(beta) - arg(alpha)

  return (
    <div className="rounded-lg border border-line bg-ground/60 px-3 py-2.5 font-mono text-xs">
      <div className="text-ink">
        |ψ⟩ = {format(alpha, 3)} |0⟩ + {format(beta, 3)} |1⟩
      </div>
      <div className="mt-1 text-ink-faint">
        |α|² = {p0.toFixed(4)} · |β|² = {p1.toFixed(4)} · sum = {norm.toFixed(6)}
      </div>
      <div className="mt-0.5 text-ink-faint">
        relative phase = {(relativePhase / Math.PI).toFixed(3)}π
      </div>
    </div>
  )
}
