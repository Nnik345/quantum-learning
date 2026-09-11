import { Link } from 'react-router-dom'

import { TRACKS } from '../content/registry'

export function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <section className="max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan">
          Learn by building
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Quantum computing, from{' '}
          <span className="text-cyan">complex numbers</span> to{' '}
          <span className="text-violet">working circuits</span>.
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-ink-dim">
          The maths first, then the theory, then a simulator you can actually build in. Every state
          vector, probability and Bloch sphere on this site is computed live — nothing is a picture
          of a result.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/circuit"
            className="rounded-lg border border-cyan bg-cyan/10 px-5 py-2.5 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20"
          >
            Open the Circuit Lab →
          </Link>
          <Link
            to="/math"
            className="rounded-lg border border-line px-5 py-2.5 text-sm text-ink-dim transition-colors hover:border-line-bright hover:text-ink"
          >
            Start with the maths
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-3 sm:grid-cols-2">
        {TRACKS.map((track) => (
          <Link
            key={track.id}
            to={`/${track.id}`}
            className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-cyan"
          >
            <h2 className="font-medium text-ink group-hover:text-cyan">{track.title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-ink-dim">{track.blurb}</p>
            <p className="mt-3 font-mono text-[11px] text-ink-faint">
              {track.topics.length} topics
            </p>
          </Link>
        ))}

        <Link
          to="/circuit"
          className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-cyan"
        >
          <h2 className="font-medium text-ink group-hover:text-cyan">Circuit Lab</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-dim">
            Drag gates onto wires and watch the state vector, probabilities and per-qubit Bloch
            spheres update as you build. Define your own gates by entering a matrix.
          </p>
          <p className="mt-3 font-mono text-[11px] text-emerald">ready</p>
        </Link>

        <Link
          to="/algorithms"
          className="group rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-bright"
        >
          <h2 className="font-medium text-ink">Algorithms &amp; Challenges</h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-dim">
            Write and run quantum programs, work through courses, and take on challenges by
            difficulty.
          </p>
          <p className="mt-3 font-mono text-[11px] text-amber">planned</p>
        </Link>
      </section>
    </div>
  )
}
