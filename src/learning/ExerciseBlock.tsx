import { useState } from 'react'
import { Link } from 'react-router-dom'

import { getExercise, type Exercise } from '../content/exercises'
import { gradeAnswer, type Verdict } from '../content/grade'
import { useProgress } from './useProgress'
import { RichText } from '../components/Tex'
import { CircuitPreview } from '../components/CircuitPreview'

/**
 * An exercise inside a lesson.
 *
 * Numeric kinds are answered here. Circuit kinds hand off to the Circuit Lab, which is where the
 * learner already has gates to drag — embedding an editable grid would mean duplicating the board's
 * drag handling for no gain.
 */
export function ExerciseBlock({ id }: { id: string }) {
  const exercise = getExercise(id)
  const progress = useProgress()

  if (!exercise) {
    return (
      <div className="rounded-lg border border-rose/40 px-4 py-3 text-sm text-rose">
        Unknown exercise “{id}”
      </div>
    )
  }

  const solved = progress.solved.has(exercise.id)

  return (
    <section className="my-6 overflow-hidden rounded-xl border border-violet/40 bg-violet/[0.04]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-violet/25 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-violet">
          Exercise
        </span>
        {solved && (
          <span className="rounded-full border border-emerald/40 px-2 py-0.5 text-[11px] text-emerald">
            solved
          </span>
        )}
      </header>

      <div className="px-4 py-4">
        <p className="text-[15px] leading-7 text-ink">
          <RichText text={exercise.prompt} />
        </p>

        {exercise.kind === 'build' ? (
          <BuildHandoff exercise={exercise} solved={solved} />
        ) : (
          <NumericAnswer exercise={exercise} solved={solved} onSolved={progress.markSolved} />
        )}
      </div>
    </section>
  )
}

/** Circuit exercises open in the Lab; the panel there does the grading. */
function BuildHandoff({
  exercise,
  solved,
}: {
  exercise: Extract<Exercise, { kind: 'build' }>
  solved: boolean
}) {
  return (
    <>
      <p className="mt-3 text-sm text-ink-dim">
        Target: <span className="text-ink">{exercise.target}</span>
      </p>
      <Link
        to={`/circuit?exercise=${exercise.id}`}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-violet bg-violet/10 px-4 py-2 text-sm text-violet transition-colors hover:bg-violet/20"
      >
        {solved ? 'Open it again' : exercise.startFrom ? 'Open the broken circuit' : 'Build it'} →
      </Link>
    </>
  )
}

/** Predict and value exercises, answered in place. */
function NumericAnswer({
  exercise,
  solved,
  onSolved,
}: {
  exercise: Extract<Exercise, { kind: 'predict' | 'value' }>
  solved: boolean
  onSolved: (id: string) => void
}) {
  const [raw, setRaw] = useState('')
  const [verdict, setVerdict] = useState<Verdict>()
  const [showHint, setShowHint] = useState(false)

  const check = () => {
    const answer = Number.parseFloat(raw)
    if (!Number.isFinite(answer)) {
      setVerdict({ correct: false, message: 'Enter a number first.' })
      return
    }
    const result = gradeAnswer(exercise, answer)
    setVerdict(result)
    if (result.correct) onSolved(exercise.id)
  }

  return (
    <>
      {exercise.kind === 'predict' && (
        <div className="mt-4">
          <CircuitPreview presetId={exercise.presetId} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          aria-label="Your answer"
          placeholder="answer"
          className="w-28 rounded-md border border-line bg-ground px-3 py-1.5 font-mono text-sm text-ink outline-none focus:border-cyan"
        />
        <span className="text-sm text-ink-faint">
          {exercise.kind === 'value' ? exercise.unit : '%'}
        </span>
        <button
          onClick={check}
          className="rounded-md border border-violet bg-violet/10 px-4 py-1.5 text-sm text-violet transition-colors hover:bg-violet/20"
        >
          Check
        </button>
        {exercise.hint && !verdict?.correct && (
          <button
            onClick={() => setShowHint((v) => !v)}
            className="text-xs text-ink-faint transition-colors hover:text-ink"
          >
            {showHint ? 'Hide hint' : 'Hint'}
          </button>
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

      {solved && !verdict && (
        <p className="mt-3 text-sm text-emerald">You have already answered this one correctly.</p>
      )}
    </>
  )
}
