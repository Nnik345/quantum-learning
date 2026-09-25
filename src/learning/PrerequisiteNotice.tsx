import { Link } from 'react-router-dom'

import { prerequisitesOf, type PathStep } from '../content/path'
import type { Progress } from './useProgress'

/**
 * A quiet warning when someone lands on a topic whose groundwork they have not read.
 *
 * Deliberately a notice, not a gate. The content still renders below it — locking would obstruct
 * anyone with prior knowledge, and since progress lives in localStorage, clearing site data would
 * otherwise lock a returning reader out of everything they had already read.
 *
 * Only the most recent few unread prerequisites are named. Listing all twenty-one before Shor would
 * be noise, and the nearest ones are the ones actually missing.
 */
export function PrerequisiteNotice({
  slug,
  progress,
}: {
  slug: string
  progress: Progress
}) {
  const unread = prerequisitesOf(slug).filter(
    (step) => !progress.completed.has(step.slug) && !progress.visited.has(step.slug),
  )

  if (unread.length === 0) return null

  // The closest prerequisites are the ones that matter; earlier gaps usually follow from them.
  const nearest = unread.slice(-3)
  const older = unread.length - nearest.length

  return (
    <aside className="mb-8 rounded-r-lg border-l-2 border-l-amber bg-surface/60 px-4 py-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber">
        Reading ahead
      </div>
      <p className="text-sm leading-6 text-ink-dim">
        This builds on {older > 0 && <>{older} earlier steps, most recently </>}
        {nearest.map((step, i) => (
          <span key={step.slug}>
            {i > 0 && (i === nearest.length - 1 ? ' and ' : ', ')}
            <Link
              to={`/${step.trackId}/${step.slug}`}
              className="text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan"
            >
              {step.topic.title}
            </Link>
          </span>
        ))}
        , which you haven&rsquo;t read yet. Carry on if you already know it — nothing is locked.
      </p>
    </aside>
  )
}

/** The "mark complete" control at the foot of a topic, plus where it sends you next. */
export function CompletionFooter({
  step,
  progress,
}: {
  step: PathStep
  progress: Progress
}) {
  const done = progress.completed.has(step.slug)

  return (
    <div className="mt-12 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-ink">
            {done ? 'Marked complete' : 'Finished this step?'}
          </div>
          <div className="mt-0.5 text-xs text-ink-faint">
            Step {step.step} of {progress.total} · {step.stage.title}
          </div>
        </div>

        {done ? (
          <button
            onClick={() => progress.markIncomplete(step.slug)}
            className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
          >
            Mark unread
          </button>
        ) : (
          <button
            onClick={() => progress.markComplete(step.slug)}
            className="rounded-md border border-cyan bg-cyan/10 px-4 py-1.5 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20"
          >
            Mark complete
          </button>
        )}
      </div>
    </div>
  )
}
