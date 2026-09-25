/**
 * Resizable size for the tutor panel, remembered between visits.
 *
 * The panel is pinned to the bottom-right corner, so growing it extends up and to the left — which
 * is why the drag handle lives at the TOP-LEFT corner and why dragging up/left increases the size.
 * A bottom-right handle (what `resize: both` would give) would try to grow the panel off-screen.
 *
 * Only applies from the `sm` breakpoint up. Below that the panel is full-width by design and there
 * is nothing sensible to resize.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export const PANEL_SIZE_KEY = 'quantum-learning:tutor-size:v1'

/** The size the panel shipped with, and its floor — it may grow, never shrink below this. */
export const MIN_WIDTH = 420
export const MIN_HEIGHT = 620

/** Below this the panel is full-screen and resizing is meaningless. */
const DESKTOP_QUERY = '(min-width: 640px)'

/** Keyboard resize step, for the handle when focused. */
const STEP = 32

export interface PanelSize {
  width: number
  height: number
}

const storage = (): Storage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/** Never larger than the viewport allows, never smaller than the shipped size. */
function clamp(size: PanelSize): PanelSize {
  const maxWidth = typeof window === 'undefined' ? MIN_WIDTH : Math.max(MIN_WIDTH, window.innerWidth - 40)
  const maxHeight =
    typeof window === 'undefined' ? MIN_HEIGHT : Math.max(MIN_HEIGHT, window.innerHeight - 40)

  // A non-finite value would reach the DOM as `width: NaN` and blank the panel, so anything that is
  // not a real number falls back to the minimum rather than propagating.
  const safe = (value: number, min: number, max: number) =>
    Number.isFinite(value) ? Math.round(Math.min(max, Math.max(min, value))) : min

  return {
    width: safe(size.width, MIN_WIDTH, maxWidth),
    height: safe(size.height, MIN_HEIGHT, maxHeight),
  }
}

function readStored(): PanelSize {
  try {
    const raw = storage()?.getItem(PANEL_SIZE_KEY)
    if (!raw) return { width: MIN_WIDTH, height: MIN_HEIGHT }
    const parsed = JSON.parse(raw) as Partial<PanelSize>
    return clamp({
      width: Number(parsed.width) || MIN_WIDTH,
      height: Number(parsed.height) || MIN_HEIGHT,
    })
  } catch {
    return { width: MIN_WIDTH, height: MIN_HEIGHT }
  }
}

export function usePanelSize() {
  const [size, setSize] = useState<PanelSize>({ width: MIN_WIDTH, height: MIN_HEIGHT })
  const [isDesktop, setIsDesktop] = useState(false)
  const [resizing, setResizing] = useState(false)
  /**
   * Origin is captured from the first pointermove, not from pointerdown.
   *
   * A pointerdown does not always carry usable coordinates — jsdom's synthetic one does not, and
   * relying on it produced NaN sizes. The move event always does, so the first one sets the origin
   * and later ones measure against it.
   */
  const dragRef = useRef<{ x?: number; y?: number; width: number; height: number }>()

  // Read stored size after mount so first paint never depends on storage.
  useEffect(() => setSize(readStored()), [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setIsDesktop(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  const commit = useCallback((next: PanelSize) => {
    const clamped = clamp(next)
    setSize(clamped)
    try {
      storage()?.setItem(PANEL_SIZE_KEY, JSON.stringify(clamped))
    } catch {
      // Size is a convenience; a blocked store must not break the panel.
    }
  }, [])

  // A narrowed window can leave a stored size too large to fit.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setSize((current) => clamp(current))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      if (!isDesktop) return
      event.preventDefault()
      const x = Number.isFinite(event.clientX) ? event.clientX : undefined
      const y = Number.isFinite(event.clientY) ? event.clientY : undefined
      dragRef.current = { x, y, width: size.width, height: size.height }
      setResizing(true)
    },
    [isDesktop, size.width, size.height],
  )

  useEffect(() => {
    if (!resizing) return

    const onMove = (event: PointerEvent) => {
      const start = dragRef.current
      if (!start || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return

      // First move fixes the origin, in case pointerdown carried no coordinates.
      if (start.x === undefined || start.y === undefined) {
        start.x = event.clientX
        start.y = event.clientY
        return
      }

      // Anchored bottom-right: moving left or up makes the panel bigger.
      commit({
        width: start.width + (start.x - event.clientX),
        height: start.height + (start.y - event.clientY),
      })
    }
    const stop = () => {
      dragRef.current = undefined
      setResizing(false)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [resizing, commit])

  /** Arrow keys resize too, so the handle is usable without a pointer. */
  const nudge = useCallback(
    (event: React.KeyboardEvent) => {
      const moves: Record<string, PanelSize> = {
        ArrowLeft: { width: size.width + STEP, height: size.height },
        ArrowRight: { width: size.width - STEP, height: size.height },
        ArrowUp: { width: size.width, height: size.height + STEP },
        ArrowDown: { width: size.width, height: size.height - STEP },
      }
      const next = moves[event.key]
      if (!next) return
      event.preventDefault()
      commit(next)
    },
    [commit, size.width, size.height],
  )

  const reset = useCallback(() => commit({ width: MIN_WIDTH, height: MIN_HEIGHT }), [commit])

  return {
    size,
    /** Inline style for the panel, or undefined below the breakpoint where it is full-screen. */
    style: isDesktop ? { width: size.width, height: size.height } : undefined,
    isDesktop,
    resizing,
    startResize,
    nudge,
    reset,
    isDefaultSize: size.width === MIN_WIDTH && size.height === MIN_HEIGHT,
  }
}
