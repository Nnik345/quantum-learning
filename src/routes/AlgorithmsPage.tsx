/**
 * PLACEHOLDER PAGE.
 *
 * The layout below sketches the intended shape only — lesson list, editor, output, challenges.
 * Nothing here executes anything, and no content decisions have been made. Waiting on a spec for:
 * the language (a Python-like DSL vs JS), the execution model (in-browser interpreter vs backend),
 * the course structure, and the challenge format and difficulty tiers.
 */

import { Link } from 'react-router-dom'

import { PlaceholderBlock } from '../components/layout/Placeholder'

const OPEN_QUESTIONS = [
  'Language: a Python-like quantum DSL, or plain JavaScript against the simulator API?',
  'Execution: interpret in the browser, or send to a backend?',
  'Course structure: linear lessons, or a dependency graph of concepts?',
  'Challenges: fixed target state, gate-count budget, or unit-test style assertions?',
  'Progress: saved locally, or tied to an account?',
]

export function AlgorithmsPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/5 px-2.5 py-0.5">
            <span className="size-1.5 rounded-full bg-amber" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-amber">
              Not built yet
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Algorithms &amp; Challenges</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-dim">
            This page is a structural placeholder. The regions below show the intended layout so the
            navigation is complete — none of them are wired up.
          </p>
        </div>
        <Link
          to="/circuit"
          className="rounded-lg border border-cyan bg-cyan/10 px-4 py-2 text-sm text-cyan transition-colors hover:bg-cyan/20"
        >
          Circuit Lab is ready →
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <aside className="card p-4">
          <SectionLabel>Courses</SectionLabel>
          <PlaceholderBlock label="Lesson list">
            An ordered list of programming lessons, each linking to an exercise.
          </PlaceholderBlock>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="card p-4">
            <SectionLabel>Editor</SectionLabel>
            <PlaceholderBlock label="Code editor">
              A syntax-highlighted editor for writing quantum programs, with a Run control.
            </PlaceholderBlock>
          </div>
          <div className="card p-4">
            <SectionLabel>Output</SectionLabel>
            <PlaceholderBlock label="Results">
              Program output, the resulting state or histogram, and any errors.
            </PlaceholderBlock>
          </div>
        </section>

        <aside className="card p-4">
          <SectionLabel>Challenges</SectionLabel>
          <div className="space-y-2">
            {['Beginner', 'Intermediate', 'Advanced'].map((tier) => (
              <div
                key={tier}
                className="rounded-lg border border-dashed border-line-bright px-3 py-2.5"
              >
                <div className="text-xs font-medium text-ink-dim">{tier}</div>
                <div className="mt-0.5 text-[11px] text-ink-faint">No challenges defined</div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="card mt-6 p-5">
        <SectionLabel>Decisions still needed</SectionLabel>
        <ul className="mt-1 space-y-1.5 pl-5 text-sm leading-6 text-ink-dim marker:text-ink-faint list-disc">
          {OPEN_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
      {children}
    </div>
  )
}
