import { Link, Navigate, useParams } from 'react-router-dom'

import { getTrack } from '../content/registry'
import { topicProgress } from '../content/types'
import { RichText } from '../components/Tex'

export function TrackIndex() {
  const { trackId } = useParams()
  const track = getTrack(trackId ?? '')
  if (!track) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{track.title}</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-dim">{track.blurb}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {track.topics.map((topic, i) => {
          const { done, total } = topicProgress(topic)
          return (
            <Link
              key={topic.slug}
              to={`/${track.id}/${topic.slug}`}
              className="group flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-cyan"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-ink-faint">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-medium text-ink group-hover:text-cyan">{topic.title}</span>
              </div>
              <p className="mt-1.5 flex-1 text-sm leading-6 text-ink-dim">
                <RichText text={topic.blurb} />
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint">
                <span>{total} sections</span>
                <span className="flex items-center gap-1.5">
                  <ProgressPips done={done} total={total} />
                  {done === 0 ? 'not written' : `${done}/${total} written`}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function ProgressPips({ done, total }: { done: number; total: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-1 w-2.5 rounded-full ${i < done ? 'bg-cyan' : 'bg-line-bright'}`}
        />
      ))}
    </span>
  )
}
