import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { getTopic, getTrack, neighbours } from '../content/registry'
import { sectionStatus, type Section } from '../content/types'
import { Blocks } from '../components/Blocks'
import { RichText } from '../components/Tex'
import { PlaceholderBlock } from '../components/layout/Placeholder'

export function TopicPage() {
  const { trackId = '', slug = '' } = useParams()
  const track = getTrack(trackId)
  const topic = getTopic(trackId, slug)
  const { previous, next } = neighbours(trackId, slug)
  const activeId = useActiveSection(topic?.sections.map((s) => s.id) ?? [])

  if (!track || !topic) return <Navigate to={track ? `/${track.id}` : '/'} replace />

  return (
    <div className="mx-auto flex max-w-[1400px] gap-10 px-4 py-10 sm:px-6">
      {/* Sidebar — generated from the section array, never hand-maintained. */}
      <aside className="sticky top-24 hidden h-fit w-56 shrink-0 lg:block">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          On this page
        </div>
        <nav className="space-y-0.5 border-l border-line">
          {topic.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={[
                '-ml-px flex items-center gap-2 border-l-2 py-1.5 pl-3 text-[13px] leading-5 transition-colors',
                activeId === section.id
                  ? 'border-l-cyan text-cyan'
                  : 'border-l-transparent text-ink-dim hover:border-l-line-bright hover:text-ink',
              ].join(' ')}
            >
              <span className="min-w-0 flex-1">{section.title.replace(/\$[^$]*\$/g, '…')}</span>
              {sectionStatus(section) === 'placeholder' && (
                <span className="size-1 shrink-0 rounded-full bg-amber/70" title="Not yet written" />
              )}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <nav className="mb-3 flex items-center gap-1.5 text-xs text-ink-faint">
          <Link to={`/${track.id}`} className="hover:text-cyan">
            {track.title}
          </Link>
          <span>/</span>
          <span className="text-ink-dim">{topic.title}</span>
        </nav>

        <h1 className="text-3xl font-semibold tracking-tight">{topic.title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-7 text-ink-dim">
          <RichText text={topic.blurb} />
        </p>
        {topic.estMinutes && (
          <p className="mt-2 text-xs text-ink-faint">~{topic.estMinutes} min read</p>
        )}

        <div className="mt-10 space-y-12">
          {topic.sections.map((section, i) => (
            <SectionView key={section.id} section={section} index={i} />
          ))}
        </div>

        <nav className="mt-16 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
          {previous ? (
            <Link
              to={`/${previous.trackId}/${previous.topic.slug}`}
              className="group rounded-lg border border-line px-4 py-3 transition-colors hover:border-cyan sm:max-w-[48%]"
            >
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">Previous</div>
              <div className="text-sm text-ink group-hover:text-cyan">← {previous.topic.title}</div>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              to={`/${next.trackId}/${next.topic.slug}`}
              className="group rounded-lg border border-line px-4 py-3 text-right transition-colors hover:border-cyan sm:max-w-[48%]"
            >
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">Next</div>
              <div className="text-sm text-ink group-hover:text-cyan">{next.topic.title} →</div>
            </Link>
          )}
        </nav>
      </div>
    </div>
  )
}

function SectionView({ section, index }: { section: Section; index: number }) {
  const status = sectionStatus(section)

  return (
    <section id={section.id} className="scroll-mt-24">
      <div className="mb-1 flex items-baseline gap-2.5">
        <span className="font-mono text-xs text-ink-faint">{String(index + 1).padStart(2, '0')}</span>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          <RichText text={section.title} />
        </h2>
        {status === 'draft' && (
          <span className="rounded border border-violet/40 px-1.5 py-px text-[10px] uppercase tracking-wider text-violet">
            draft
          </span>
        )}
      </div>

      {section.summary && (
        <p className="mb-4 text-sm text-ink-faint">
          <RichText text={section.summary} />
        </p>
      )}

      {section.blocks?.length ? (
        <Blocks blocks={section.blocks} />
      ) : (
        <PlaceholderBlock>
          Section <span className="font-mono text-ink-dim">{section.id}</span> is a stub. Add a{' '}
          <span className="font-mono text-ink-dim">blocks</span> array to this section in the content
          file to write it.
        </PlaceholderBlock>
      )}
    </section>
  )
}

/** Highlight the section currently in view in the sidebar. */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string | undefined>(ids[0])
  const key = ids.join('|')

  useEffect(() => {
    const sectionIds = key ? key.split('|') : []
    if (sectionIds.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    )

    for (const id of sectionIds) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [key])

  return active
}
