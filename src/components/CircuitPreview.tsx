import { Link } from 'react-router-dom'

import { getPreset } from '../lib/quantum/presets'
import { CircuitGrid } from '../circuit/CircuitGrid'
import { simulate } from '../lib/quantum/simulate'
import { significantAmplitudes } from '../lib/quantum/state'
import { format } from '../lib/quantum/complex'

const noop = () => {}

/**
 * A worked circuit shown inside a lesson: the real grid, rendered read-only, plus a link that
 * loads the identical circuit into the Circuit Lab. The reader can check every claim on the page
 * rather than taking the diagram on trust.
 */
export function CircuitPreview({ presetId }: { presetId: string }) {
  const preset = getPreset(presetId)

  if (!preset) {
    return (
      <div className="rounded-lg border border-rose/40 px-4 py-3 text-sm text-rose">
        Unknown circuit preset “{presetId}”
      </div>
    )
  }

  const { states, errors } = simulate(preset.circuit)
  const final = states[states.length - 1]
  const amplitudes = significantAmplitudes(final, 1e-6).slice(0, 4)

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="text-xs font-medium text-ink-dim">{preset.name}</span>
        <Link
          to={`/circuit?preset=${preset.id}`}
          className="rounded border border-cyan px-2 py-0.5 text-[11px] text-cyan transition-colors hover:bg-cyan/10"
        >
          Open in Circuit Lab →
        </Link>
      </div>

      {/* pointer-events-none keeps the grid inert: this is an illustration, not an editor. */}
      <div className="overflow-x-auto p-3">
        <div className="pointer-events-none w-max">
          <CircuitGrid
            circuit={preset.circuit}
            drag={null}
            hover={null}
            inspectStep={preset.circuit.columns}
            onSelect={noop}
            onInspectStep={noop}
            onGatePointerDown={noop}
            onControlHandlePointerDown={noop}
            onBackgroundPointerDown={noop}
            onEditInput={noop}
          />
        </div>
      </div>

      <div className="border-t border-line px-3 py-2">
        <p className="text-[11px] leading-5 text-ink-faint">{preset.summary}</p>
        {errors.length === 0 && amplitudes.length > 0 && (
          <p className="mt-1 font-mono text-[11px] text-ink-dim">
            <span className="text-ink-faint">result: </span>
            {amplitudes.map(({ index, label, amp }, i) => (
              <span key={index}>
                {i > 0 && <span className="text-ink-faint"> + </span>}
                {format(amp, 3)}|{label}⟩
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
