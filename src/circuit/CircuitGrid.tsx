/**
 * The circuit canvas.
 *
 * Rendered as SVG and driven by pointer events rather than HTML5 drag-and-drop, which behaves
 * unreliably over SVG and gives no live snap preview. Pointer events also work on touch.
 */

import { forwardRef } from 'react'

import {
  DEFAULT_INPUT,
  gateDef,
  inputKet,
  spanOf,
  type Circuit,
  type Placement,
} from '../lib/quantum/circuit'
import { isMeasure } from '../lib/quantum/gates'
import {
  CELL_H,
  CELL_W,
  GATE_SIZE,
  HEADER_H,
  INPUT_BTN_H,
  INPUT_BTN_W,
  INPUT_BTN_X,
  LABEL_W,
  colorsFor,
  columnX,
  gridHeight,
  gridWidth,
  wireY,
} from './geometry'
import type { DragState } from './dragTypes'

interface Props {
  circuit: Circuit
  selectedId?: string
  drag: DragState | null
  /** Cell currently under the pointer during a drag, and whether dropping there is legal. */
  hover: { wire: number; column: number; valid: boolean } | null
  /** Column boundary the panels are inspecting: state shown is after column `inspectStep - 1`. */
  inspectStep: number
  onSelect: (id: string | undefined) => void
  onInspectStep: (step: number) => void
  onGatePointerDown: (e: React.PointerEvent, placement: Placement) => void
  onControlHandlePointerDown: (e: React.PointerEvent, placement: Placement) => void
  onBackgroundPointerDown: (e: React.PointerEvent) => void
  /** Open the input-state picker for a wire. */
  onEditInput: (wire: number) => void
}

export const CircuitGrid = forwardRef<SVGSVGElement, Props>(function CircuitGrid(
  {
    circuit,
    selectedId,
    drag,
    hover,
    inspectStep,
    onSelect,
    onInspectStep,
    onGatePointerDown,
    onControlHandlePointerDown,
    onBackgroundPointerDown,
    onEditInput,
  },
  ref,
) {
  const width = gridWidth(circuit.columns)
  const height = gridHeight(circuit.numQubits)

  return (
    <svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="no-select block touch-none"
      onPointerDown={onBackgroundPointerDown}
    >
      {/* Column headers — click to inspect the state at that point in the circuit. */}
      {Array.from({ length: circuit.columns }, (_, col) => (
        <g key={`h${col}`} onPointerDown={(e) => { e.stopPropagation(); onInspectStep(col + 1) }} className="cursor-pointer">
          <rect
            x={LABEL_W + col * CELL_W}
            y={0}
            width={CELL_W}
            height={HEADER_H}
            fill={inspectStep === col + 1 ? '#172140' : 'transparent'}
            rx={4}
          />
          <text
            x={columnX(col)}
            y={HEADER_H / 2 + 4}
            textAnchor="middle"
            fontSize={10}
            fontFamily="monospace"
            fill={inspectStep === col + 1 ? '#22d3ee' : '#6b7d9c'}
          >
            {col + 1}
          </text>
        </g>
      ))}

      {/* Wires, each with a clickable input-state button in the gutter. */}
      {Array.from({ length: circuit.numQubits }, (_, wire) => {
        const input = circuit.inputs[wire] ?? DEFAULT_INPUT
        const custom = input.preset === 'custom'
        const nonDefault = input.preset !== '0'
        return (
          <g key={`w${wire}`}>
            <text x={6} y={wireY(wire) + 4} fontSize={12} fontFamily="monospace" fill="#9fb0cc">
              q{wire}
            </text>

            {/* A real control, so it carries a role, a name and keyboard activation rather than
                being a pointer-only shape. */}
            <g
              role="button"
              tabIndex={0}
              aria-label={`Input state for q${wire}: currently ${inputKet(input)}`}
              className="cursor-pointer focus:outline-none"
              onPointerDown={(e) => {
                e.stopPropagation()
                onEditInput(wire)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onEditInput(wire)
                }
              }}
            >
              <title>{`q${wire} starts in ${inputKet(input)} — click to change`}</title>
              <rect
                x={INPUT_BTN_X}
                y={wireY(wire) - INPUT_BTN_H / 2}
                width={INPUT_BTN_W}
                height={INPUT_BTN_H}
                rx={5}
                fill={nonDefault ? '#0d3543' : '#131c30'}
                stroke={nonDefault ? '#22d3ee' : '#24304d'}
                strokeWidth={1.2}
              />
              <text
                x={INPUT_BTN_X + INPUT_BTN_W / 2}
                y={wireY(wire) + 4}
                textAnchor="middle"
                fontSize={12}
                fontFamily="monospace"
                fill={nonDefault ? '#7fe6f7' : '#6b7d9c'}
                style={{ pointerEvents: 'none' }}
              >
                {inputKet(input)}
              </text>
              {custom && (
                <circle cx={INPUT_BTN_X + INPUT_BTN_W - 4} cy={wireY(wire) - INPUT_BTN_H / 2 + 4} r={2.5} fill="#fbbf24" />
              )}
            </g>

            <line
              x1={LABEL_W - 4}
              y1={wireY(wire)}
              x2={width - 6}
              y2={wireY(wire)}
              stroke="#35456b"
              strokeWidth={1.5}
            />
          </g>
        )
      })}

      {/* Inspection marker. */}
      {inspectStep > 0 && inspectStep <= circuit.columns && (
        <line
          x1={LABEL_W + inspectStep * CELL_W - 1}
          y1={HEADER_H - 4}
          x2={LABEL_W + inspectStep * CELL_W - 1}
          y2={height - 8}
          stroke="#22d3ee"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.75}
        />
      )}

      {/* Drop preview. */}
      {drag && hover && (
        <rect
          x={LABEL_W + hover.column * CELL_W + 3}
          y={HEADER_H + hover.wire * CELL_H + 3}
          width={CELL_W - 6}
          height={CELL_H - 6}
          rx={6}
          fill={hover.valid ? '#22d3ee' : '#fb7185'}
          opacity={0.16}
          stroke={hover.valid ? '#22d3ee' : '#fb7185'}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* Placements. */}
      {circuit.placements.map((p) => (
        <PlacementView
          key={p.id}
          circuit={circuit}
          placement={p}
          selected={p.id === selectedId}
          dimmed={drag?.kind === 'move' && drag.id === p.id}
          onSelect={onSelect}
          onPointerDown={onGatePointerDown}
          onControlHandlePointerDown={onControlHandlePointerDown}
        />
      ))}
    </svg>
  )
})

function PlacementView({
  circuit,
  placement,
  selected,
  dimmed,
  onSelect,
  onPointerDown,
  onControlHandlePointerDown,
}: {
  circuit: Circuit
  placement: Placement
  selected: boolean
  dimmed: boolean
  onSelect: (id: string) => void
  onPointerDown: (e: React.PointerEvent, p: Placement) => void
  onControlHandlePointerDown: (e: React.PointerEvent, p: Placement) => void
}) {
  const def = gateDef(circuit, placement.gate)
  const colors = colorsFor(def?.category ?? 'multi')
  const x = columnX(placement.column)
  const { top, bottom } = spanOf(placement)

  // Standard notation shortcuts: a controlled X draws as ⊕, a controlled Z as a plain dot.
  const controlled = placement.controls.length > 0
  const asCnot = controlled && placement.gate === 'X'
  const asCz = controlled && placement.gate === 'Z'
  const isSwap = placement.gate === 'SWAP'

  return (
    <g
      opacity={dimmed ? 0.3 : 1}
      className="cursor-grab"
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect(placement.id)
        onPointerDown(e, placement)
      }}
    >
      {/* Enlarged hit area covering the gate's whole span. */}
      <rect
        x={x - CELL_W / 2 + 2}
        y={wireY(top) - CELL_H / 2 + 2}
        width={CELL_W - 4}
        height={(bottom - top) * CELL_H + CELL_H - 4}
        fill="transparent"
      />

      {selected && (
        <rect
          x={x - CELL_W / 2 + 2}
          y={wireY(top) - CELL_H / 2 + 2}
          width={CELL_W - 4}
          height={(bottom - top) * CELL_H + CELL_H - 4}
          rx={7}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
      )}

      {/* Vertical link through controls and targets. */}
      {bottom > top && (
        <line x1={x} y1={wireY(top)} x2={x} y2={wireY(bottom)} stroke={colors.stroke} strokeWidth={2} />
      )}

      {/* Control dots. */}
      {placement.controls.map((cw) => (
        <circle key={`c${cw}`} cx={x} cy={wireY(cw)} r={5.5} fill={colors.stroke} />
      ))}

      {/* Targets. */}
      <TargetMarks
        placement={placement}
        label={def?.label ?? '?'}
        paramSymbol={def?.params?.[0]?.symbol}
        x={x}
        colors={colors}
        asCnot={asCnot}
        asCz={asCz}
        isSwap={isSwap}
      />

      {/* Control handle: drag onto another wire to add or remove a control. */}
      {selected && !isMeasure(placement.gate) && (
        <g
          className="cursor-crosshair"
          onPointerDown={(e) => {
            e.stopPropagation()
            onControlHandlePointerDown(e, placement)
          }}
        >
          <circle
            cx={x + GATE_SIZE / 2 + 7}
            cy={wireY(top) - GATE_SIZE / 2 - 2}
            r={7}
            fill="#111a2e"
            stroke="#22d3ee"
            strokeWidth={1.2}
          />
          <text
            x={x + GATE_SIZE / 2 + 7}
            y={wireY(top) - GATE_SIZE / 2 + 2}
            textAnchor="middle"
            fontSize={11}
            fill="#22d3ee"
            style={{ pointerEvents: 'none' }}
          >
            •
          </text>
        </g>
      )}
    </g>
  )
}

/**
 * How a gate's target wires are drawn.
 *
 * A multi-target gate (a 2-qubit custom gate, say) gets ONE box spanning its wires with small
 * index labels, rather than a separate box per wire — otherwise it reads as two unrelated gates
 * that happen to be joined by a line.
 */
function TargetMarks({
  placement,
  label,
  paramSymbol,
  x,
  colors,
  asCnot,
  asCz,
  isSwap,
}: {
  placement: Placement
  label: string
  paramSymbol?: string
  x: number
  colors: { stroke: string; fill: string; text: string }
  asCnot: boolean
  asCz: boolean
  isSwap: boolean
}) {
  if (isSwap) {
    return (
      <>
        {placement.targets.map((tw) => (
          <SwapMark key={tw} x={x} y={wireY(tw)} color={colors.stroke} />
        ))}
      </>
    )
  }

  if (isMeasure(placement.gate)) {
    return <MeasureBox x={x} y={wireY(placement.targets[0])} colors={colors} />
  }

  if (asCnot) {
    return (
      <>
        {placement.targets.map((tw) => (
          <CnotTarget key={tw} x={x} y={wireY(tw)} color={colors.stroke} />
        ))}
      </>
    )
  }

  if (asCz) {
    return (
      <>
        {placement.targets.map((tw) => (
          <circle key={tw} cx={x} cy={wireY(tw)} r={5.5} fill={colors.stroke} />
        ))}
      </>
    )
  }

  const sublabel = paramLabel(paramSymbol, placement.params[0])

  if (placement.targets.length > 1) {
    const top = Math.min(...placement.targets)
    const bottom = Math.max(...placement.targets)
    const y1 = wireY(top) - GATE_SIZE / 2
    const height = wireY(bottom) + GATE_SIZE / 2 - y1
    return (
      <g>
        <rect
          x={x - GATE_SIZE / 2}
          y={y1}
          width={GATE_SIZE}
          height={height}
          rx={6}
          fill={colors.fill}
          stroke={colors.stroke}
          strokeWidth={1.4}
        />
        <text
          x={x}
          y={y1 + height / 2 + 5}
          textAnchor="middle"
          fontSize={label.length <= 3 ? 15 : 10}
          fontFamily="monospace"
          fontWeight={600}
          fill={colors.text}
          style={{ pointerEvents: 'none' }}
        >
          {label}
        </text>
        {/* Which wire is which matters for a non-symmetric two-qubit gate. */}
        {placement.targets.map((tw, i) => (
          <text
            key={tw}
            x={x - GATE_SIZE / 2 + 5}
            y={wireY(tw) + 3}
            fontSize={8}
            fontFamily="monospace"
            fill={colors.text}
            opacity={0.7}
            style={{ pointerEvents: 'none' }}
          >
            {i}
          </text>
        ))}
      </g>
    )
  }

  return (
    <GateBox
      x={x}
      y={wireY(placement.targets[0])}
      height={GATE_SIZE}
      label={label}
      sublabel={sublabel}
      colors={colors}
    />
  )
}

const paramLabel = (symbol?: string, value?: number): string | undefined => {
  if (symbol === undefined || value === undefined) return undefined
  const inPi = value / Math.PI
  const rounded = Math.round(inPi * 100) / 100
  return `${rounded}π`
}

function GateBox({
  x,
  y,
  height,
  label,
  sublabel,
  colors,
}: {
  x: number
  y: number
  height: number
  label: string
  sublabel?: string
  colors: { stroke: string; fill: string; text: string }
}) {
  const short = label.length <= 3
  return (
    <g>
      <rect
        x={x - GATE_SIZE / 2}
        y={y - height / 2}
        width={GATE_SIZE}
        height={height}
        rx={6}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1.4}
      />
      <text
        x={x}
        y={sublabel ? y - 1 : y + 5}
        textAnchor="middle"
        fontSize={short ? 15 : 10}
        fontFamily="monospace"
        fontWeight={600}
        fill={colors.text}
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
      {sublabel && (
        <text
          x={x}
          y={y + 11}
          textAnchor="middle"
          fontSize={8}
          fontFamily="monospace"
          fill={colors.text}
          opacity={0.85}
          style={{ pointerEvents: 'none' }}
        >
          {sublabel}
        </text>
      )}
    </g>
  )
}

function CnotTarget({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={12} fill="#111a2e" stroke={color} strokeWidth={2} />
      <line x1={x - 12} y1={y} x2={x + 12} y2={y} stroke={color} strokeWidth={2} />
      <line x1={x} y1={y - 12} x2={x} y2={y + 12} stroke={color} strokeWidth={2} />
    </g>
  )
}

function SwapMark({ x, y, color }: { x: number; y: number; color: string }) {
  const r = 8
  return (
    <g>
      <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} stroke={color} strokeWidth={2.4} />
      <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} stroke={color} strokeWidth={2.4} />
    </g>
  )
}

function MeasureBox({
  x,
  y,
  colors,
}: {
  x: number
  y: number
  colors: { stroke: string; fill: string; text: string }
}) {
  return (
    <g>
      <rect
        x={x - GATE_SIZE / 2}
        y={y - GATE_SIZE / 2}
        width={GATE_SIZE}
        height={GATE_SIZE}
        rx={6}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={1.4}
      />
      {/* Dial and needle — the conventional meter symbol. */}
      <path
        d={`M ${x - 11} ${y + 7} A 11 11 0 0 1 ${x + 11} ${y + 7}`}
        fill="none"
        stroke={colors.text}
        strokeWidth={1.6}
      />
      <line x1={x} y1={y + 7} x2={x + 8} y2={y - 6} stroke={colors.text} strokeWidth={1.6} />
    </g>
  )
}
