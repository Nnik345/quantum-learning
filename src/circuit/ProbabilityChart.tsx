import { basisLabel, probabilities, type StateVector } from '../lib/quantum/state'

export function ProbabilityChart({ state }: { state: StateVector }) {
  const probs = probabilities(state)
  const entries = [...probs].map((p, i) => ({ p, label: basisLabel(i, state.n) }))
  const anyVisible = entries.some((e) => e.p > 1e-9)

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {entries.map(({ p, label }) => (
          <div key={label} className="flex items-center gap-2 font-mono text-xs">
            <span className={p > 1e-9 ? 'w-16 shrink-0 text-cyan' : 'w-16 shrink-0 text-ink-faint'}>
              |{label}⟩
            </span>
            <span className="h-3 flex-1 overflow-hidden rounded bg-line/60">
              <span
                className="block h-full rounded bg-gradient-to-r from-cyan-dim to-cyan transition-[width] duration-200"
                style={{ width: `${p * 100}%` }}
              />
            </span>
            <span className={p > 1e-9 ? 'w-14 text-right text-ink' : 'w-14 text-right text-ink-faint'}>
              {(p * 100).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
      {!anyVisible && <p className="text-xs text-ink-faint">Nothing to show.</p>}
      <p className="text-[11px] leading-5 text-ink-faint">
        Exact probabilities from the state vector — what you would converge to with infinitely many
        shots.
      </p>
    </div>
  )
}
