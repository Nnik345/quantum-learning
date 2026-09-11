/**
 * Bloch sphere renderer, shared by the theory pages (large, interactive) and the circuit board's
 * per-qubit readout (small, many at once).
 *
 * The arrow length is meaningful: a pure state reaches the surface, while an entangled qubit's
 * arrow shrinks toward the centre. That is the whole reason this component takes a vector rather
 * than a (θ, φ) pair.
 */

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

export interface BlochProps {
  /** Bloch vector; |r| ≤ 1. */
  vector: { x: number; y: number; z: number }
  size?: number
  /** Orbit controls + axis labels. Off for the small circuit-panel spheres. */
  interactive?: boolean
  showLabels?: boolean
  /** Smoothly move to a new vector instead of jumping. */
  animate?: boolean
  className?: string
  color?: string
}

const CYAN = '#22d3ee'
const VIOLET = '#a78bfa'
const LINE = '#35456b'
const FAINT = '#24304d'

/** A circle of radius 1 in the given plane, used for the three great circles. */
function ring(plane: 'xy' | 'xz' | 'yz', segments = 96): [number, number, number][] {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const a = Math.cos(t)
    const b = Math.sin(t)
    if (plane === 'xy') pts.push([a, b, 0])
    else if (plane === 'xz') pts.push([a, 0, b])
    else pts.push([0, a, b])
  }
  return pts
}

/**
 * The state arrow.
 *
 * Note the axis mapping: physics puts |0⟩ at +z, but three.js treats +y as up. We map
 * (x, y, z)_bloch → (x, z, y)_three so the sphere appears the way it does in every textbook.
 */
function StateArrow({ vector, animate, color }: Required<Pick<BlochProps, 'vector' | 'animate' | 'color'>>) {
  const group = useRef<THREE.Group>(null)
  const target = useMemo(
    () => new THREE.Vector3(vector.x, vector.z, vector.y),
    [vector.x, vector.y, vector.z],
  )
  const current = useRef(target.clone())
  const arrow = useRef<THREE.ArrowHelper | null>(null)

  useEffect(() => {
    if (!group.current) return
    if (!arrow.current) {
      arrow.current = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 0),
        1,
        new THREE.Color(color).getHex(),
        0.18,
        0.09,
      )
      group.current.add(arrow.current)
    }

    const helper = arrow.current
    const apply = (v: THREE.Vector3) => {
      const len = v.length()
      if (len < 1e-6) {
        helper.visible = false
        return
      }
      helper.visible = true
      helper.setDirection(v.clone().normalize())
      helper.setLength(len, Math.min(0.18, len * 0.4), Math.min(0.09, len * 0.2))
    }

    if (!animate) {
      current.current.copy(target)
      apply(target)
      return
    }

    let frame = 0
    const step = () => {
      current.current.lerp(target, 0.18)
      apply(current.current)
      if (current.current.distanceTo(target) > 1e-4) frame = requestAnimationFrame(step)
      else {
        current.current.copy(target)
        apply(target)
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, animate, color])

  return <group ref={group} />
}

function Scene({ vector, showLabels, interactive, animate, color }: Required<Omit<BlochProps, 'size' | 'className'>>) {
  const tip = useMemo(
    () => new THREE.Vector3(vector.x, vector.z, vector.y),
    [vector.x, vector.y, vector.z],
  )

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 5]} intensity={0.5} />

      {/* Translucent shell. */}
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#4b6fb8" transparent opacity={0.06} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={FAINT} wireframe transparent opacity={0.22} />
      </mesh>

      <Line points={ring('xy')} color={LINE} lineWidth={1} />
      <Line points={ring('xz')} color={LINE} lineWidth={1} />
      <Line points={ring('yz')} color={LINE} lineWidth={1} />

      {/* Axes: three.js y is up, and up is |0⟩. */}
      <Line points={[[-1.15, 0, 0], [1.15, 0, 0]]} color={LINE} lineWidth={1.5} />
      <Line points={[[0, 0, -1.15], [0, 0, 1.15]]} color={LINE} lineWidth={1.5} />
      <Line points={[[0, -1.15, 0], [0, 1.15, 0]]} color={LINE} lineWidth={1.5} />

      <StateArrow vector={vector} animate={animate} color={color} />

      {/* Tip marker, so a zero-length (maximally mixed) vector still shows something at the centre. */}
      <mesh position={tip}>
        <sphereGeometry args={[0.045, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {showLabels && (
        <>
          <AxisLabel position={[0, 1.32, 0]} text="|0⟩" color={CYAN} />
          <AxisLabel position={[0, -1.32, 0]} text="|1⟩" color={CYAN} />
          <AxisLabel position={[1.34, 0, 0]} text="x  |+⟩" color="#6b7d9c" />
          <AxisLabel position={[0, 0, 1.34]} text="y  |i⟩" color="#6b7d9c" />
        </>
      )}

      {interactive && (
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={2.2}
          maxDistance={6}
          rotateSpeed={0.6}
        />
      )}
    </>
  )
}

/**
 * Axis labels as DOM rather than drei's <Text>, which pulls a default font over the network at
 * runtime — that would fail silently offline. Html tracks the 3D position and stays crisp.
 */
function AxisLabel({ position, text, color }: { position: [number, number, number]; text: string; color: string }) {
  return (
    <Html position={position} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <span
        style={{
          color,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </Html>
  )
}

export function BlochSphere({
  vector,
  size = 260,
  interactive = true,
  showLabels = true,
  animate = true,
  className,
  color = VIOLET,
}: BlochProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      // The canvas swallows pointer events; without this the page can't be scrolled over a sphere.
      onWheel={(e) => !interactive && e.stopPropagation()}
    >
      <Canvas camera={{ position: [2.6, 1.9, 2.6], fov: 42 }} dpr={[1, 2]}>
        <Scene
          vector={vector}
          showLabels={showLabels}
          interactive={interactive}
          animate={animate}
          color={color}
        />
      </Canvas>
    </div>
  )
}

export default BlochSphere
