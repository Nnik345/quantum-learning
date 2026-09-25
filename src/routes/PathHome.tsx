import { Link } from 'react-router-dom'

import { PATH, STAGES, type PathStep } from '../content/path'
import { useProgress, statusOf, type Progress, type StepStatus } from '../learning/useProgress'
import { RichText } from '../components/Tex'

const TRACK_LABEL: Record<string, string> = {
  math: 'maths',
  theory: 'theory',
  algorithms: 'algorithm',
}

/**
 * The front door: where you are, what to read next, and the whole route laid out.
 *
 * Replaces the old three-doors home page. The point is that a newcomer should never have to work
 * out for themselves that complex numbers come before Dirac notation.
 */
export function PathHome() {
  const progress = useProgress()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan">
          Learn by building
        </p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Quantum computing, from{' '}
          <span className="text-cyan">complex numbers</span> to{' '}
          <span className="text-violet">Shor&rsquo;s algorithm</span>.
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-ink-dim">
          Twenty-two steps in one order that makes sense. Each builds on the last, and every
          algorithm comes with a circuit you can open and run.
        </p>
      </header>

      <ProgressBar progress={progress} />
      <NextUp progress={progress} />

      <div className="mt-12 space-y-10">
        {STAGES.map((stage, i) => (
          <section key={stage.id}>
            <div className="mb-1 flex items-baseline gap-2.5">
              <span className="font-mono text-xs text-ink-faint">{i + 1}</span>
              <h2 className="text-lg font-semibold tracking-tight text-ink">{stage.title}</h2>
            </div>
            <p className="mb-4 max-w-2xl pl-7 text-sm leading-6 text-ink-faint">{stage.blurb}</p>

            <ol className="space-y-1.5 pl-7">
              {PATH.filter((s) => s.stage.id === stage.id).map((step) => (
                <StepRow key={step.slug} step={step} status={statusOf(step, progress)} />
              ))}
            </ol>
          </section>
        ))}
      </div>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Link to="/circuit" className="text-sm text-cyan hover:underline">
          Skip ahead to the Circuit Lab →
        </Link>
        {!progress.isFresh && (
          <button
            onClick={() => {
              if (confirm('Clear all progress and start over?')) progress.reset()
            }}
            className="rounded border border-line px-2.5 py-1 text-[11px] text-ink-faint transition-colors hover:border-rose hover:text-rose"
          >
            Reset progress
          </button>
        )}
      </footer>
    </div>
  )
}

function ProgressBar({ progress }: { progress: Progress }) {
  return (
    <div className="mt-8">
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-ink-dim">
          {progress.isFresh ? 'Not started' : `${progress.completedCount} of ${progress.total} complete`}
        </span>
        <span className="font-mono text-ink-faint">{progress.percent}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={progress.completedCount}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label="Learning path progress"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-dim to-cyan transition-[width] duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}

/** The single most important element on the page: one obvious thing to do next. */
function NextUp({ progress }: { progress: Progress }) {
  const step = progress.next

  if (!step) {
    return (
      <div className="mt-6 rounded-xl border border-emerald/40 bg-emerald/5 p-5">
        <div className="text-sm font-medium text-emerald">You&rsquo;ve finished the path.</div>
        <p className="mt-1 text-sm leading-6 text-ink-dim">
          All twenty-two steps complete. The Circuit Lab is still there whenever you want to build
          something of your own.
        </p>
      </div>
    )
  }

  return (
    <Link
      to={`/${step.trackId}/${step.slug}`}
      className="group mt-6 block rounded-xl border border-cyan bg-cyan/5 p-5 transition-colors hover:bg-cyan/10"
    >
      <div className="flex items-baseline gap-2 text-[11px] uppercase tracking-wider text-cyan">
        {progress.isFresh ? 'Start here' : 'Next up'}
        <span className="font-mono normal-case tracking-normal text-ink-faint">
          step {step.step} of {progress.total} · {step.stage.title}
        </span>
      </div>
      <div className="mt-1.5 text-lg font-medium text-ink group-hover:text-cyan">
        {step.topic.title}
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-dim">
        <RichText text={step.topic.blurb} />
      </p>
      <div className="mt-3 text-sm text-cyan">
        {progress.isFresh ? 'Begin' : 'Continue'} →
      </div>
    </Link>
  )
}

const MARKER: Record<StepStatus, { glyph: string; className: string }> = {
  complete: { glyph: '●', className: 'text-cyan' },
  next: { glyph: '○', className: 'text-cyan' },
  visited: { glyph: '◐', className: 'text-ink-dim' },
  upcoming: { glyph: '○', className: 'text-line-bright' },
}

function StepRow({ step, status }: { step: PathStep; status: StepStatus }) {
  const marker = MARKER[status]

  return (
    <li>
      <Link
        to={`/${step.trackId}/${step.slug}`}
        className={[
          'group flex items-baseline gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface',
          status === 'next' ? 'bg-surface ring-1 ring-cyan/40' : '',
        ].join(' ')}
      >
        <span className={`font-mono text-[11px] ${marker.className}`} aria-hidden>
          {marker.glyph}
        </span>
        <span className="w-5 shrink-0 font-mono text-[11px] text-ink-faint">{step.step}</span>
        <span
          className={[
            'min-w-0 flex-1 text-sm',
            status === 'complete' ? 'text-ink-dim' : 'text-ink',
            'group-hover:text-cyan',
          ].join(' ')}
        >
          {step.topic.title}
        </span>
        <span className="shrink-0 text-[10px] text-ink-faint">
          {status === 'complete' ? 'done' : TRACK_LABEL[step.trackId]}
        </span>
      </Link>
    </li>
  )
}
