import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { getTopic, getTrack } from '../content/registry'
import { pathNeighbours, pathStepFor } from '../content/path'
import { useProgress } from '../learning/useProgress'
import { CompletionFooter, PrerequisiteNotice } from '../learning/PrerequisiteNotice'
import { sectionStatus, type Section } from '../content/types'
import { Blocks } from '../components/Blocks'
import { RichText } from '../components/Tex'
import { PlaceholderBlock } from '../components/layout/Placeholder'

export function TopicPage() {
  const { trackId = '', slug = '' } = useParams()
  const track = getTrack(trackId)
  const topic = getTopic(trackId, slug)
  // Prev/next follow the learning path, not the track, so Measurement leads to Quantum Random
  // Numbers rather than dead-ending at the bottom of the theory track.
  const { previous, next } = pathNeighbours(slug)
  const step = pathStepFor(slug)
  const activeId = useActiveSection(topic?.sections.map((s) => s.id) ?? [])
  const progress = useProgress()

  // Opening a topic counts as visiting it — enough for the path to show signs of life, while
  // "complete" stays an explicit choice.
  useEffect(() => {
    if (slug) progress.markVisited(slug)
  }, [slug, progress.markVisited])

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
        <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
          {step && (
            <>
              <Link to="/path" className="font-mono text-cyan hover:underline">
                step {step.step}/{progress.total}
              </Link>
              <span>·</span>
              <span className="text-ink-dim">{step.stage.title}</span>
              <span>·</span>
            </>
          )}
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

        <div className="mt-8">
          <PrerequisiteNotice slug={slug} progress={progress} />
        </div>

        <div className="mt-2 space-y-12">
          {topic.sections.map((section, i) => (
            <SectionView key={section.id} section={section} index={i} />
          ))}
        </div>

        {step && <CompletionFooter step={step} progress={progress} />}

        <nav className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          {previous ? (
            <Link
              to={`/${previous.trackId}/${previous.slug}`}
              className="group rounded-lg border border-line px-4 py-3 transition-colors hover:border-cyan sm:max-w-[48%]"
            >
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">
                Step {previous.step}
              </div>
              <div className="text-sm text-ink group-hover:text-cyan">← {previous.topic.title}</div>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to={`/${next.trackId}/${next.slug}`}
              className="group rounded-lg border border-line px-4 py-3 text-right transition-colors hover:border-cyan sm:max-w-[48%]"
            >
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">
                Step {next.step}
              </div>
              <div className="text-sm text-ink group-hover:text-cyan">{next.topic.title} →</div>
            </Link>
          ) : (
            <Link
              to="/path"
              className="group rounded-lg border border-emerald/40 px-4 py-3 text-right transition-colors hover:bg-emerald/5 sm:max-w-[48%]"
            >
              <div className="text-[11px] uppercase tracking-wider text-ink-faint">Last step</div>
              <div className="text-sm text-emerald">Back to the path →</div>
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
