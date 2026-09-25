import { Link } from 'react-router-dom'

import { PYTHON_LESSONS } from '../../content/pythonLessons'
import { usePythonRunner } from '../../lib/python/useRunner'
import { ServiceStatus } from './PythonPanels'

/**
 * The way in: a short course you work through, and a playground for everything else.
 *
 * The guide is the default because a blank editor teaches nobody Qiskit. The playground is one
 * click away for anyone who already knows what they want to write.
 */
export function PythonHome() {
  const { service } = usePythonRunner()

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
        Real Qiskit, on your machine
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quantum computing in Python</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ink-dim">
        Six short lessons that go from a single gate to Grover&rsquo;s search. You write the code
        yourself and it is checked by running it — any correct Qiskit passes, however you wrote it.
      </p>
      <div className="mt-4">
        <ServiceStatus service={service} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={`/python/${PYTHON_LESSONS[0].slug}`}
          className="rounded-lg bg-cyan px-5 py-2.5 text-sm font-semibold text-ground transition-transform hover:-translate-y-0.5"
        >
          Start lesson 1 →
        </Link>
        <Link
          to="/python/playground"
          className="rounded-lg border border-line-bright px-5 py-2.5 text-sm text-ink transition-colors hover:border-cyan hover:text-cyan"
        >
          Skip to the playground
        </Link>
      </div>

      <ol className="mt-10 space-y-2.5">
        {PYTHON_LESSONS.map((lesson, i) => (
          <li key={lesson.slug}>
            <Link
              to={`/python/${lesson.slug}`}
              className="group flex gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-cyan"
            >
              <span className="font-mono text-sm text-ink-faint">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink group-hover:text-cyan">
                  {lesson.title}
                </span>
                <span className="mt-0.5 block text-sm leading-6 text-ink-dim">{lesson.blurb}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-xl border border-line bg-surface/40 p-4">
        <h2 className="text-sm font-semibold text-ink">Prefer a blank page?</h2>
        <p className="mt-1.5 text-sm leading-6 text-ink-dim">
          The{' '}
          <Link to="/python/playground" className="text-cyan hover:underline">
            playground
          </Link>{' '}
          is an open editor with the full Qiskit library and no task attached — write anything, run
          it, and load whatever circuit comes out onto the board.
        </p>
      </div>
    </div>
  )
}
