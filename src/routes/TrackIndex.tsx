import { Link, Navigate, useParams } from 'react-router-dom'

import { getTrack } from '../content/registry'
import { pathStepFor } from '../content/path'
import { useProgress, statusOf } from '../learning/useProgress'
import { RichText } from '../components/Tex'

export function TrackIndex() {
  const { trackId } = useParams()
  const progress = useProgress()
  const track = getTrack(trackId ?? '')
  if (!track) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{track.title}</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-dim">{track.blurb}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {track.topics.map((topic) => {
          // Step number comes from the path, so browsing here never loses the sense of order.
          const step = pathStepFor(topic.slug)
          const status = step ? statusOf(step, progress) : 'upcoming'
          return (
            <Link
              key={topic.slug}
              to={`/${track.id}/${topic.slug}`}
              className="group flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-cyan"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-ink-faint">
                  {step ? String(step.step).padStart(2, '0') : '--'}
                </span>
                <span className="min-w-0 flex-1 font-medium text-ink group-hover:text-cyan">
                  {topic.title}
                </span>
                {status === 'complete' && <span className="text-[10px] text-cyan">done</span>}
              </div>
              <p className="mt-1.5 flex-1 text-sm leading-6 text-ink-dim">
                <RichText text={topic.blurb} />
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint">
                <span>{topic.sections.length} sections</span>
                <span>
                  {status === 'complete'
                    ? 'completed'
                    : status === 'visited'
                      ? 'read, not marked done'
                      : step
                        ? `step ${step.step} on the path`
                        : ''}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
