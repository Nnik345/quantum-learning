import { useState } from 'react'

import type { Circuit } from '../lib/quantum/circuit'
import { runShots, type ShotResult } from '../lib/quantum/simulate'
import { randomSeed } from '../lib/quantum/rng'

const PRESETS = [100, 1000, 8192]

export function ShotsPanel({ circuit }: { circuit: Circuit }) {
  const [shots, setShots] = useState(1000)
  const [seedText, setSeedText] = useState('')
  const [result, setResult] = useState<ShotResult | undefined>()
  const [busy, setBusy] = useState(false)

  const run = () => {
    setBusy(true)
    // Yield a frame so the button's pressed state paints before a long synchronous run.
    setTimeout(() => {
      const seed = seedText.trim() === '' ? randomSeed() : Number(seedText) >>> 0
      setResult(runShots(circuit, shots, seed))
      setBusy(false)
    }, 0)
  }

  const max = result ? Math.max(...Object.values(result.counts)) : 0
  const rows = result
    ? Object.entries(result.counts).sort(([a], [b]) => a.localeCompare(b))
    : []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-24">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">
            Shots
          </span>
          <input
            type="number"
            min={1}
            max={100000}
            value={shots}
            onChange={(e) => setShots(Math.min(100000, Math.max(1, Number(e.target.value) || 1)))}
            className="w-full rounded-md border border-line bg-ground px-2 py-1.5 font-mono text-sm text-ink outline-none focus:border-cyan"
          />
        </label>
        <label className="flex-1 min-w-24">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-faint">
            Seed (optional)
          </span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="random"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))}
            className="w-full rounded-md border border-line bg-ground px-2 py-1.5 font-mono text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cyan"
          />
        </label>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-md border border-cyan bg-cyan/10 px-4 py-1.5 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20 disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Run'}
        </button>
      </div>

      <div className="flex gap-1.5">
        {PRESETS.map((n) => (
          <button
            key={n}
            onClick={() => setShots(n)}
            className={[
              'rounded border px-2 py-0.5 font-mono text-[11px] transition-colors',
              shots === n ? 'border-cyan text-cyan' : 'border-line text-ink-faint hover:text-ink',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>

      {result && (
        <>
          <div className="space-y-1 pt-1">
            {rows.map(([key, count]) => (
              <div key={key} className="flex items-center gap-2 font-mono text-xs">
                <span className="w-16 shrink-0 text-violet">{key}</span>
                <span className="h-3 flex-1 overflow-hidden rounded bg-line/60">
                  <span
                    className="block h-full rounded bg-gradient-to-r from-violet-dim to-violet"
                    style={{ width: `${max ? (count / max) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-20 text-right text-ink">
                  {count}
                  <span className="ml-1 text-ink-faint">
                    {((count / result.shots) * 100).toFixed(1)}%
                  </span>
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] leading-5 text-ink-faint">
            {result.measuredAllAtEnd
              ? 'No measurement gates in the circuit, so every qubit was measured at the end.'
              : `Measured q${result.measuredQubits.join(', q')} — bitstrings show only those wires, in order.`}{' '}
            Seed <span className="font-mono text-ink-dim">{result.seed}</span>; re-run with the same
            seed to reproduce exactly.
          </p>
        </>
      )}

      {!result && (
        <p className="text-[11px] leading-5 text-ink-faint">
          Sampling repeats the circuit and collapses at each measurement gate — the honest picture of
          what a real device returns, shot noise and all.
        </p>
      )}
    </div>
  )
}
