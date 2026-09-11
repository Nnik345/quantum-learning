import { BUILTIN_GATES, type GateDef } from '../lib/quantum/gates'
import type { Circuit } from '../lib/quantum/circuit'
import { colorsFor } from './geometry'

interface Props {
  circuit: Circuit
  onDragStart: (e: React.PointerEvent, gateId: string, label: string) => void
  onOpenCustomDialog: () => void
  onEditCustom: (key: string) => void
  onDeleteCustom: (key: string) => void
}

const GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Pauli', ids: ['I', 'X', 'Y', 'Z'] },
  { title: 'Superposition', ids: ['H'] },
  { title: 'Phase', ids: ['S', 'Sdg', 'T', 'Tdg'] },
  { title: 'Rotations', ids: ['RX', 'RY', 'RZ', 'P'] },
  { title: 'Two-qubit', ids: ['SWAP'] },
  { title: 'Measurement', ids: ['MEASURE'] },
]

export function GatePalette({
  circuit,
  onDragStart,
  onOpenCustomDialog,
  onEditCustom,
  onDeleteCustom,
}: Props) {
  const customs = Object.values(circuit.customGates)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink">Gates</h2>
        <p className="mt-0.5 text-xs leading-5 text-ink-faint">
          Drag onto a wire. Select a placed gate to add controls or change its angle.
        </p>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            {group.title}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.ids.map((id) => {
              const def = BUILTIN_GATES.find((g) => g.id === id)
              if (!def) return null
              return <Chip key={id} def={def} onDragStart={onDragStart} />
            })}
          </div>
        </div>
      ))}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Custom
          </span>
          <button
            onClick={onOpenCustomDialog}
            className="rounded border border-line px-1.5 py-0.5 text-[11px] text-cyan transition-colors hover:border-cyan"
          >
            + New
          </button>
        </div>

        {customs.length === 0 ? (
          <p className="text-xs leading-5 text-ink-faint">
            Define a gate by entering its matrix. Expressions like{' '}
            <span className="font-mono text-ink-dim">1/sqrt(2)</span> and{' '}
            <span className="font-mono text-ink-dim">e^(i*pi/4)</span> are accepted.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {customs.map((gate) => (
              <div key={gate.id} className="group relative">
                <button
                  title={`${gate.name} — drag onto a wire`}
                  onPointerDown={(e) => onDragStart(e, `custom:${gate.id}`, gate.label)}
                  className="flex h-9 min-w-9 cursor-grab touch-none items-center justify-center rounded-md border border-violet bg-[#241b45] px-2 font-mono text-sm text-[#c9b8ff] transition-colors hover:brightness-125"
                >
                  {gate.label}
                </button>
                {/* Icon-only, so the accessible name has to come from aria-label — the glyph
                    alone announces as "✎" to a screen reader. */}
                <button
                  onClick={() => onEditCustom(gate.id)}
                  aria-label={`Edit ${gate.name}`}
                  title={`Edit ${gate.name}`}
                  className="absolute -right-1 -top-1 hidden size-4 items-center justify-center rounded-full border border-line bg-surface text-[9px] text-ink-dim group-hover:flex hover:text-cyan"
                >
                  ✎
                </button>
                <button
                  onClick={() => onDeleteCustom(gate.id)}
                  aria-label={`Delete ${gate.name} and its placements`}
                  title={`Delete ${gate.name} and its placements`}
                  className="absolute -bottom-1 -right-1 hidden size-4 items-center justify-center rounded-full border border-line bg-surface text-[9px] text-ink-dim group-hover:flex hover:text-rose"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Chip({
  def,
  onDragStart,
}: {
  def: GateDef
  onDragStart: (e: React.PointerEvent, gateId: string, label: string) => void
}) {
  const colors = colorsFor(def.category)
  return (
    <button
      title={`${def.name} — ${def.description}`}
      onPointerDown={(e) => onDragStart(e, def.id, def.label)}
      className="flex h-9 min-w-9 cursor-grab touch-none items-center justify-center rounded-md border px-2 font-mono text-sm transition-all hover:brightness-125"
      style={{ borderColor: colors.stroke, backgroundColor: colors.fill, color: colors.text }}
    >
      {def.label}
    </button>
  )
}
