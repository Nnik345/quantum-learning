import { gateDef, type Circuit, type Placement } from '../lib/quantum/circuit'
import { isMeasure } from '../lib/quantum/gates'
import { Tex } from '../components/Tex'
import type { CircuitStore } from './useCircuitStore'

const ANGLE_PRESETS: [string, number][] = [
  ['π/8', Math.PI / 8],
  ['π/4', Math.PI / 4],
  ['π/2', Math.PI / 2],
  ['π', Math.PI],
  ['3π/2', (3 * Math.PI) / 2],
  ['2π', 2 * Math.PI],
]

export function GateInspector({
  circuit,
  placement,
  store,
  onClose,
}: {
  circuit: Circuit
  placement: Placement
  store: CircuitStore
  onClose: () => void
}) {
  const def = gateDef(circuit, placement.gate)
  if (!def) return null

  const wires = Array.from({ length: circuit.numQubits }, (_, i) => i)

  /**
   * Put target slot `slot` on `wire`. If that wire is already another slot of the same gate the
   * two exchange places, which is the only sensible reading and avoids a "wire used twice"
   * rejection the user did not ask for.
   */
  const assignTarget = (slot: number, wire: number) => {
    const targets = [...placement.targets]
    const current = targets.indexOf(wire)
    if (current === slot) return
    if (current >= 0) targets[current] = targets[slot]
    targets[slot] = wire
    store.setTargets(placement.id, targets)
  }

  const targetClass = (active: boolean) =>
    [
      'flex-1 rounded border px-2 py-1 text-[11px] transition-colors',
      active
        ? 'border-cyan bg-cyan/10 text-cyan'
        : 'border-line text-ink-faint hover:border-line-bright hover:text-ink',
    ].join(' ')

  return (
    <div className="space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">{def.name}</div>
          <div className="text-xs text-ink-faint">
            column {placement.column + 1} · target q{placement.targets.join(', q')}
            {placement.controls.length > 0 && ` · control q${placement.controls.join(', q')}`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-line px-1.5 text-xs text-ink-faint hover:text-ink"
          aria-label="Close inspector"
        >
          ✕
        </button>
      </div>

      <p className="text-xs leading-5 text-ink-dim">{def.description}</p>

      {def.latex && (
        <div className="overflow-x-auto rounded-lg border border-line bg-ground/60 px-3 py-2">
          <Tex tex={def.latex} display />
        </div>
      )}

      {/* Parameters. */}
      {def.params?.map((param, i) => (
        <div key={param.name}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-xs text-ink-dim">{param.symbol}</span>
            <span className="font-mono text-xs text-cyan">
              {((placement.params[i] ?? param.default) / Math.PI).toFixed(3)}π
            </span>
          </div>
          <input
            type="range"
            min={-2 * Math.PI}
            max={2 * Math.PI}
            step={Math.PI / 180}
            value={placement.params[i] ?? param.default}
            onChange={(e) => {
              const next = [...placement.params]
              next[i] = Number(e.target.value)
              store.setParams(placement.id, next)
            }}
            className="w-full accent-[#22d3ee]"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ANGLE_PRESETS.map(([label, value]) => (
              <button
                key={label}
                onClick={() => {
                  const next = [...placement.params]
                  next[i] = value
                  store.setParams(placement.id, next)
                }}
                className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-ink-faint transition-colors hover:border-cyan hover:text-cyan"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Wire assignment. Each target slot can be put on any wire, so a two-qubit gate is not
          restricted to adjacent wires — SWAP q0 ↔ q2 is a legal placement. */}
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          Wires
        </div>
        <div className="space-y-1">
          {wires.map((wire) => {
            const slot = placement.targets.indexOf(wire)
            const isTarget = slot >= 0
            const isControl = placement.controls.includes(wire)
            return (
              <div key={wire} className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 font-mono text-xs text-ink-dim">q{wire}</span>

                {def.arity === 1 ? (
                  <button
                    onClick={() => assignTarget(0, wire)}
                    disabled={isTarget}
                    className={targetClass(isTarget)}
                  >
                    {isTarget ? 'target' : 'make target'}
                  </button>
                ) : (
                  Array.from({ length: def.arity }, (_, s) => (
                    <button
                      key={s}
                      onClick={() => assignTarget(s, wire)}
                      title={
                        placement.gate === 'SWAP'
                          ? `Put swap end ${s === 0 ? 'A' : 'B'} on q${wire}`
                          : `Put target ${s} (qubit ${s} of the gate) on q${wire}`
                      }
                      className={targetClass(slot === s)}
                    >
                      {placement.gate === 'SWAP' ? (s === 0 ? 'end A' : 'end B') : `t${s}`}
                    </button>
                  ))
                )}

                <button
                  onClick={() => store.toggleControl(placement.id, wire)}
                  disabled={isTarget || isMeasure(placement.gate)}
                  className={[
                    'flex-1 rounded border px-2 py-1 text-[11px] transition-colors disabled:opacity-30',
                    isControl
                      ? 'border-violet bg-violet/10 text-violet'
                      : 'border-line text-ink-faint hover:border-line-bright hover:text-ink',
                  ].join(' ')}
                >
                  {isControl ? 'control ✓' : 'add control'}
                </button>
              </div>
            )
          })}
        </div>
        {def.arity > 1 && (
          <p className="mt-1.5 text-[11px] leading-5 text-ink-faint">
            {placement.gate === 'SWAP'
              ? 'The two ends can sit on any wires, adjacent or not. Wires crossed by the link are reserved in this column.'
              : `${def.name} uses ${def.arity} targets, and their order decides which qubit is which. They need not be adjacent.`}
          </p>
        )}
      </div>

      <button
        onClick={() => {
          store.removeGate(placement.id)
          onClose()
        }}
        className="w-full rounded-md border border-rose/50 px-3 py-1.5 text-xs text-rose transition-colors hover:bg-rose/10"
      >
        Delete gate
      </button>
    </div>
  )
}
