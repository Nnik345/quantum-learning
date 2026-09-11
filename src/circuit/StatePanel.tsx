import { arg, format } from '../lib/quantum/complex'
import { significantAmplitudes, type StateVector } from '../lib/quantum/state'

/** Phase → hue, so equal phases share a colour and opposite phases sit across the wheel. */
export const phaseColor = (phase: number): string => {
  const deg = ((phase * 180) / Math.PI + 360) % 360
  return `hsl(${deg.toFixed(0)} 75% 62%)`
}

export function StatePanel({ state }: { state: StateVector }) {
  const amps = significantAmplitudes(state, 1e-9)

  return (
    <div className="space-y-3">
      <DiracLine state={state} />

      {amps.length === 0 ? (
        <p className="text-xs text-ink-faint">No amplitudes above the display threshold.</p>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 border-b border-line pb-1 text-[10px] uppercase tracking-wider text-ink-faint">
            <span>Basis</span>
            <span>Amplitude</span>
            <span className="text-right">Prob</span>
            <span className="text-right">Phase</span>
          </div>
          {amps.map(({ index, label, amp, probability }) => {
            const phase = arg(amp)
            return (
              <div
                key={index}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 py-0.5 font-mono text-xs"
              >
                <span className="text-cyan">|{label}⟩</span>
                <span className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-ink-dim">{format(amp, 3)}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.sqrt(probability) * 100}%`,
                        background: phaseColor(phase),
                      }}
                    />
                  </span>
                </span>
                <span className="text-right text-ink">{(probability * 100).toFixed(1)}%</span>
                <span className="w-12 text-right" style={{ color: phaseColor(phase) }}>
                  {(phase / Math.PI).toFixed(2)}π
                </span>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] leading-5 text-ink-faint">
        Bar length is |amplitude|; colour is phase. Two states with the same colour add
        constructively, opposite colours cancel.
      </p>
    </div>
  )
}

/** The state written the way it appears in a textbook. */
function DiracLine({ state }: { state: StateVector }) {
  const amps = significantAmplitudes(state, 1e-6)
  const shown = amps.slice(0, 8)

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-ground/60 px-3 py-2.5">
      <div className="whitespace-nowrap font-mono text-[13px] leading-6">
        <span className="text-ink-faint">|ψ⟩ = </span>
        {shown.map(({ index, label, amp }, i) => (
          <span key={index}>
            {i > 0 && <span className="text-ink-faint"> + </span>}
            <span style={{ color: phaseColor(arg(amp)) }}>{format(amp, 3)}</span>
            <span className="text-cyan">|{label}⟩</span>
          </span>
        ))}
        {amps.length > shown.length && (
          <span className="text-ink-faint"> + {amps.length - shown.length} more…</span>
        )}
      </div>
    </div>
  )
}
