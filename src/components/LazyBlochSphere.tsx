/**
 * Lazy wrapper around the Bloch sphere.
 *
 * three.js and its React bindings are roughly a megabyte — most of the bundle. Only the theory
 * pages and the circuit's Bloch tab need them, so the chunk is loaded on first use rather than on
 * first page load. The fallback reserves the exact final size so nothing jumps when it arrives.
 */

import { Suspense, lazy } from 'react'

import type { BlochProps } from './BlochSphere'

const Sphere = lazy(() => import('./BlochSphere'))

export function BlochSphere(props: BlochProps) {
  const size = props.size ?? 260
  return (
    <Suspense fallback={<SpherePlaceholder size={size} className={props.className} />}>
      <Sphere {...props} />
    </Suspense>
  )
}

function SpherePlaceholder({ size, className }: { size: number; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full border border-dashed border-line ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <span className="text-[10px] text-ink-faint">loading…</span>
    </div>
  )
}

export type { BlochProps }
