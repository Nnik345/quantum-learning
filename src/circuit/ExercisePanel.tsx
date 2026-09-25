import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { BuildExercise } from '../content/exercises'
import { gradeCircuit, type Verdict } from '../content/grade'
import type { Circuit } from '../lib/quantum/circuit'
import { RichText } from '../components/Tex'
import { pathStepFor } from '../content/path'

/**
 * The exercise being attempted, shown beside the board.
 *
 * Checking grades the circuit as it stands — by running it, never by comparing it to the author's
 * arrangement — so the learner is free to build it however they like. The panel never shows the
 * solution's gates, only what their own circuit did and what was asked for.
 */
export function ExercisePanel({
  exercise,
  circuit,
  solved,
  onSolved,
}: {
  exercise: BuildExercise
  circuit: Circuit
  solved: boolean
  onSolved: (id: string) => void
}) {
  const [verdict, setVerdict] = useState<Verdict>()
  const [showHint, setShowHint] = useState(false)

  // The path already knows which track a topic lives in, so the link cannot go stale if one moves.
  const step = pathStepFor(exercise.slug)
  const lesson = step ? `/${step.trackId}/${step.slug}` : undefined

  const check = () => {
    const result = gradeCircuit(exercise, circuit)
    setVerdict(result)
    if (result.correct) onSolved(exercise.id)
  }

  const passed = verdict?.correct || (solved && !verdict)

  return (
    <section className="rounded-xl border border-violet/40 bg-violet/[0.04] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-violet">
          Exercise
        </span>
        {passed && (
          <span className="rounded-full border border-emerald/40 px-2 py-0.5 text-[11px] text-emerald">
            solved
          </span>
        )}
      </div>

      <p className="mt-2.5 text-sm leading-6 text-ink">
        <RichText text={exercise.prompt} />
      </p>
      <p className="mt-2 text-xs text-ink-dim">
        Target: <span className="text-ink">{exercise.target}</span>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={check}
          className="rounded-md border border-violet bg-violet/10 px-4 py-1.5 text-sm text-violet transition-colors hover:bg-violet/20"
        >
          Check my circuit
        </button>
        {exercise.hint && !verdict?.correct && (
          <button
            onClick={() => setShowHint((v) => !v)}
            className="text-xs text-ink-faint transition-colors hover:text-ink"
          >
            {showHint ? 'Hide hint' : 'Hint'}
          </button>
        )}
        {lesson && (
          <Link
            to={lesson}
            className="ml-auto text-xs text-ink-faint transition-colors hover:text-cyan"
          >
            Back to the lesson →
          </Link>
        )}
      </div>

      {showHint && exercise.hint && !verdict?.correct && (
        <p className="mt-3 text-sm leading-6 text-ink-faint">
          <RichText text={exercise.hint} />
        </p>
      )}

      {verdict && (
        <p
          role="status"
          className={`mt-3 text-sm leading-6 ${verdict.correct ? 'text-emerald' : 'text-amber'}`}
        >
          {verdict.message}
        </p>
      )}
    </section>
  )
}
