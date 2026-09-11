/**
 * Widgets a content section can embed by key.
 *
 * Add an entry to WIDGETS and any section can use it via `{ kind: 'widget', widget: '<key>' }`.
 */

import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { WidgetKey } from './types'
import { BlochSphere } from '../components/LazyBlochSphere'
import { Tex } from '../components/Tex'
import { applyGate, blochVector, zeroState, type StateVector } from '../lib/quantum/state'
import { BUILTIN_BY_ID } from '../lib/quantum/gates'
import { format } from '../lib/quantum/complex'

// ---------------------------------------------------------------------------
// Bloch sphere explorer
// ---------------------------------------------------------------------------

const GATE_BUTTONS = ['X', 'Y', 'Z', 'H', 'S', 'T'] as const

function BlochExplorer() {
  const [state, setState] = useState<StateVector>(() => zeroState(1))
  const [history, setHistory] = useState<string[]>([])

  const bloch = useMemo(() => blochVector(state, 0), [state])

  const apply = (gateId: string) => {
    const def = BUILTIN_BY_ID[gateId]
    if (!def?.matrix) return
    setState((prev) => {
      const next: StateVector = { n: prev.n, re: prev.re.slice(), im: prev.im.slice() }
      applyGate(next, def.matrix!([]), [0])
      return next
    })
    setHistory((h) => [...h, gateId])
  }

  /** Set the state directly from spherical coordinates. */
  const setAngles = (theta: number, phi: number) => {
    const st = zeroState(1)
    st.re[0] = Math.cos(theta / 2)
    st.im[0] = 0
    st.re[1] = Math.sin(theta / 2) * Math.cos(phi)
    st.im[1] = Math.sin(theta / 2) * Math.sin(phi)
    setState(st)
    setHistory([])
  }

  const theta = Math.acos(Math.max(-1, Math.min(1, bloch.z)))
  const phi = Math.atan2(bloch.y, bloch.x)

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <BlochSphere vector={bloch} size={250} className="mx-auto shrink-0" />

      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            Apply a gate
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GATE_BUTTONS.map((g) => (
              <button
                key={g}
                onClick={() => apply(g)}
                className="rounded-md border border-line bg-surface-2 px-3 py-1.5 font-mono text-sm text-ink transition-colors hover:border-cyan hover:text-cyan"
              >
                {BUILTIN_BY_ID[g].label}
              </button>
            ))}
            <button
              onClick={() => {
                setState(zeroState(1))
                setHistory([])
              }}
              className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
            >
              Reset
            </button>
          </div>
        </div>

        <AngleSlider label="θ" value={theta} max={Math.PI} onChange={(t) => setAngles(t, phi)} />
        <AngleSlider label="φ" value={phi} min={-Math.PI} max={Math.PI} onChange={(p) => setAngles(theta, p)} />

        <div className="rounded-lg border border-line bg-ground/60 px-3 py-2.5 font-mono text-sm">
          <div className="text-ink">
            |ψ⟩ = {format(({ re: state.re[0], im: state.im[0] }))} |0⟩ +{' '}
            {format({ re: state.re[1], im: state.im[1] })} |1⟩
          </div>
          <div className="mt-1 text-xs text-ink-faint">
            r = ({bloch.x.toFixed(3)}, {bloch.y.toFixed(3)}, {bloch.z.toFixed(3)}) · |r| ={' '}
            {bloch.length.toFixed(3)}
          </div>
        </div>

        {history.length > 0 && (
          <div className="text-xs text-ink-faint">
            Applied: <span className="font-mono text-violet">{history.join(' → ')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function AngleSlider({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-mono text-ink-dim">{label}</span>
        <span className="font-mono text-ink-faint">
          {(value / Math.PI).toFixed(2)}π
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#22d3ee]"
      />
    </label>
  )
}

// ---------------------------------------------------------------------------
// Argand plane
// ---------------------------------------------------------------------------

function ArgandPlane() {
  const [z, setZ] = useState({ re: 0.7, im: 0.55 })
  const svgRef = useRef<SVGSVGElement>(null)
  const SIZE = 260
  const SCALE = 90 // pixels per unit

  const toScreen = (re: number, im: number) => ({
    x: SIZE / 2 + re * SCALE,
    y: SIZE / 2 - im * SCALE,
  })

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0 && e.type !== 'pointerdown') return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * SIZE
    const y = ((e.clientY - rect.top) / rect.height) * SIZE
    setZ({ re: (x - SIZE / 2) / SCALE, im: (SIZE / 2 - y) / SCALE })
  }

  const p = toScreen(z.re, z.im)
  const modulus = Math.hypot(z.re, z.im)
  const argument = Math.atan2(z.im, z.re)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="shrink-0 cursor-crosshair touch-none rounded-lg border border-line bg-ground"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          handlePointer(e)
        }}
        onPointerMove={handlePointer}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={SCALE} fill="none" stroke="#24304d" strokeDasharray="3 3" />
        <line x1={10} y1={SIZE / 2} x2={SIZE - 10} y2={SIZE / 2} stroke="#35456b" />
        <line x1={SIZE / 2} y1={10} x2={SIZE / 2} y2={SIZE - 10} stroke="#35456b" />
        <text x={SIZE - 18} y={SIZE / 2 - 8} fill="#6b7d9c" fontSize="11" fontFamily="monospace">Re</text>
        <text x={SIZE / 2 + 8} y={18} fill="#6b7d9c" fontSize="11" fontFamily="monospace">Im</text>

        {/* Argument arc. */}
        <path
          d={describeArc(SIZE / 2, SIZE / 2, 30, 0, -argument)}
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1.5"
          opacity="0.8"
        />
        <line x1={SIZE / 2} y1={SIZE / 2} x2={p.x} y2={p.y} stroke="#22d3ee" strokeWidth="2" />
        <circle cx={p.x} cy={p.y} r="6" fill="#22d3ee" />
      </svg>

      <div className="min-w-0 flex-1 space-y-2 font-mono text-sm">
        <div className="text-ink">z = {format(z)}</div>
        <div className="text-ink-dim">
          |z| = {modulus.toFixed(3)}
        </div>
        <div className="text-ink-dim">
          arg(z) = {(argument / Math.PI).toFixed(3)}π = {((argument * 180) / Math.PI).toFixed(1)}°
        </div>
        <div className="text-ink-dim">|z|² = {(modulus * modulus).toFixed(3)}</div>
        <div className="pt-2 font-sans text-xs text-ink-faint">
          Drag anywhere in the plane. The dashed circle is the unit circle, where every valid
          single-amplitude phase lives.
        </div>
      </div>
    </div>
  )
}

function describeArc(cx: number, cy: number, r: number, start: number, end: number): string {
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  const large = Math.abs(end - start) > Math.PI ? 1 : 0
  const sweep = end > start ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} ${sweep} ${x2} ${y2}`
}

// ---------------------------------------------------------------------------
// Gate matrix reference
// ---------------------------------------------------------------------------

function MatrixPlayground() {
  const gates = ['X', 'Y', 'Z', 'H', 'S', 'T', 'RX', 'RY', 'RZ']
  const [selected, setSelected] = useState('H')
  const def = BUILTIN_BY_ID[selected]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {gates.map((g) => (
          <button
            key={g}
            onClick={() => setSelected(g)}
            className={[
              'rounded-md border px-2.5 py-1 font-mono text-sm transition-colors',
              selected === g
                ? 'border-cyan bg-surface-2 text-cyan'
                : 'border-line text-ink-dim hover:text-ink',
            ].join(' ')}
          >
            {BUILTIN_BY_ID[g].label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-line bg-ground/60 px-4 py-4">
        <div className="mb-1 text-sm font-medium text-ink">{def.name}</div>
        <p className="mb-3 text-sm text-ink-dim">{def.description}</p>
        {def.latex && <Tex tex={def.latex} display />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CircuitTeaser() {
  return (
    <Link
      to="/circuit"
      className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-2 px-4 py-3.5 transition-colors hover:border-cyan"
    >
      <div>
        <div className="text-sm font-medium text-ink">Try it in the Circuit Lab</div>
        <div className="text-xs text-ink-faint">
          Build the circuit and watch the state vector and Bloch spheres update live.
        </div>
      </div>
      <span className="text-cyan">→</span>
    </Link>
  )
}

export const WIDGETS: Record<WidgetKey, () => React.ReactElement> = {
  'bloch-sphere': BlochExplorer,
  'argand-plane': ArgandPlane,
  'matrix-playground': MatrixPlayground,
  'circuit-teaser': CircuitTeaser,
}
