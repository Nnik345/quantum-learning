import { Link } from 'react-router-dom'

import { TRACKS } from '../content/registry'
import { pathStepFor } from '../content/path'
import { useProgress, statusOf } from '../learning/useProgress'
import { RichText } from '../components/Tex'

/**
 * The browsing view, for readers who already know what they want.
 *
 * The path is the way through the material; this is the index. Every entry still shows its step
 * number, so jumping in from here never loses the sense of where it sits in the whole.
 */
export function Reference() {
  const progress = useProgress()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Reference</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-dim">
        Everything on the site, grouped by kind rather than by reading order. If you are working
        through it for the first time,{' '}
        <Link to="/path" className="text-cyan hover:underline">
          follow the path
        </Link>{' '}
        instead.
      </p>

      <div className="mt-10 space-y-10">
        {TRACKS.map((track) => (
          <section key={track.id}>
            <h2 className="text-lg font-semibold tracking-tight text-ink">{track.title}</h2>
            <p className="mb-4 max-w-2xl text-sm leading-6 text-ink-faint">{track.blurb}</p>

            <div className="grid gap-2 sm:grid-cols-2">
              {track.topics.map((topic) => {
                const step = pathStepFor(topic.slug)
                const status = step ? statusOf(step, progress) : 'upcoming'
                return (
                  <Link
                    key={topic.slug}
                    to={`/${track.id}/${topic.slug}`}
                    className="group rounded-lg border border-line bg-surface p-3 transition-colors hover:border-cyan"
                  >
                    <div className="flex items-baseline gap-2">
                      {step && (
                        <span className="font-mono text-[11px] text-ink-faint">
                          {String(step.step).padStart(2, '0')}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-sm font-medium text-ink group-hover:text-cyan">
                        {topic.title}
                      </span>
                      {status === 'complete' && (
                        <span className="shrink-0 text-[10px] text-cyan">done</span>
                      )}
                      {status === 'visited' && (
                        <span className="shrink-0 text-[10px] text-ink-faint">read</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-ink-dim">
                      <RichText text={topic.blurb} />
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
