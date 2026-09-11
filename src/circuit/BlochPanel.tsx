import { useMemo } from 'react'

import { BlochSphere } from '../components/LazyBlochSphere'
import { blochVector, type StateVector } from '../lib/quantum/state'

/**
 * Per-qubit Bloch spheres from the reduced density matrix.
 *
 * The arrow shrinking inside the sphere is the visible signature of entanglement — build a Bell
 * state and both arrows collapse to the centre.
 */
export function BlochPanel({ state }: { state: StateVector }) {
  const vectors = useMemo(
    () => Array.from({ length: state.n }, (_, q) => ({ q, bloch: blochVector(state, q) })),
    [state],
  )

  const entangled = vectors.filter(({ bloch }) => bloch.length < 0.999)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 min-[420px]:grid-cols-3">
        {vectors.map(({ q, bloch }) => {
          const mixed = bloch.length < 0.999
          return (
            <div key={q} className="rounded-lg border border-line bg-ground/40 p-1.5">
              <div className="flex items-baseline justify-between px-1 pb-0.5">
                <span className="font-mono text-xs text-ink-dim">q{q}</span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: mixed ? '#fbbf24' : '#6b7d9c' }}
                  title="Length of the Bloch vector: 1 for a pure state, 0 for maximally mixed"
                >
                  |r| {bloch.length.toFixed(2)}
                </span>
              </div>
              <BlochSphere
                vector={bloch}
                size={118}
                interactive={false}
                showLabels={false}
                color={mixed ? '#fbbf24' : '#a78bfa'}
                className="mx-auto"
              />
            </div>
          )
        })}
      </div>

      {entangled.length > 0 ? (
        <p className="rounded-r-lg border-l-2 border-l-amber bg-surface/60 px-3 py-2 text-[11px] leading-5 text-ink-dim">
          <span className="font-semibold text-amber">
            q{entangled.map((e) => e.q).join(', q')} {entangled.length === 1 ? 'is' : 'are'} mixed.
          </span>{' '}
          A shortened arrow means the qubit is entangled with another — its state cannot be
          described on its own, so there is no point on the surface to put it.
        </p>
      ) : (
        <p className="text-[11px] leading-5 text-ink-faint">
          Every arrow reaches the surface, so the register is a product state — no entanglement yet.
        </p>
      )}
    </div>
  )
}
