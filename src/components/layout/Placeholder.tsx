import type { ReactNode } from 'react'

/**
 * Marks unwritten content unmistakably.
 *
 * Deliberately loud: filler prose that looks like real content is worse than an obvious gap,
 * because it is easy to ship by accident.
 */
export function PlaceholderBlock({
  label = 'Placeholder',
  children,
}: {
  label?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-bright bg-surface/50 px-4 py-5">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="inline-block size-1.5 rounded-full bg-amber" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber">
          {label}
        </span>
      </div>
      <div className="text-sm leading-relaxed text-ink-faint">
        {children ?? 'Content to be written. Structure and navigation are in place.'}
      </div>
    </div>
  )
}
