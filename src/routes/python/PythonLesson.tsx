import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { PYTHON_LESSONS, getPythonLesson, type LessonBlock } from '../../content/pythonLessons'
import { gradeAgainst, type Verdict } from '../../content/grade'
import { usePythonRunner } from '../../lib/python/useRunner'
import { CodeEditor } from '../../components/editor/CodeEditor'
import { RichText } from '../../components/Tex'
import { Output, ResultCircuit, ServiceStatus } from './PythonPanels'
import { publishPython, unpublishPython, takePendingCode } from '../../lib/python/pythonBridge'

/**
 * One lesson of the Qiskit guide: read it, then write the code yourself.
 *
 * The task is graded by running what they wrote and comparing BEHAVIOUR against a reference, using
 * the same comparison the circuit exercises use. So any correct Qiskit passes — a Bell pair built
 * on qubit 1 instead of qubit 0, or with the gates in another order, is still a Bell pair. Nothing
 * here ever compares source text.
 */
export function PythonLesson() {
  const { slug = '' } = useParams()
  const lesson = getPythonLesson(slug)
  const index = PYTHON_LESSONS.findIndex((l) => l.slug === slug)

  const runner = usePythonRunner()
  const [code, setCode] = useState(lesson?.task.starter ?? '')
  const [verdict, setVerdict] = useState<Verdict>()
  const [showHint, setShowHint] = useState(false)

  // Moving between lessons resets the editor to the new stub rather than carrying work across.
  useEffect(() => {
    setCode(lesson?.task.starter ?? '')
    setVerdict(undefined)
    setShowHint(false)
    runner.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the lesson changes
  }, [slug])

  /*
   * What the tutor can see: the code, the run, the verdict, and the task as printed on the page.
   * Never `lesson.task.solution` — it can help them think, but it cannot hand over the answer.
   */
  useEffect(() => {
    if (!lesson) return
    publishPython(
      {
        code,
        where: 'lesson',
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        taskPrompt: lesson.task.prompt,
        taskTarget: lesson.task.target,
        stdout: runner.run?.stdout,
        stderr: runner.run?.stderr,
        error: runner.run?.error ?? undefined,
        verdict: verdict?.message,
      },
      setCode,
    )
    return unpublishPython
  }, [lesson, code, runner.run, verdict])

  useEffect(() => {
    const parked = takePendingCode()
    if (parked) setCode(parked)
  }, [])

  if (!lesson) return <Navigate to="/python" replace />

  const check = async () => {
    setVerdict(undefined)
    const result = await runner.execute(code)

    if (!result?.circuit) {
      setVerdict({
        correct: false,
        message:
          'That ran, but no circuit came back. Make sure your circuit is in a variable called “circuit”.',
      })
      return
    }
    setVerdict(
      gradeAgainst(
        result.circuit,
        lesson.task.solution,
        lesson.task.grade,
        lesson.task.target,
        'Your circuit has no gates on it yet.',
      ),
    )
  }

  const previous = PYTHON_LESSONS[index - 1]
  const next = PYTHON_LESSONS[index + 1]

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
        <Link to="/python" className="hover:text-cyan">
          Python
        </Link>
        <span>/</span>
        <span className="font-mono text-cyan">
          {index + 1} of {PYTHON_LESSONS.length}
        </span>
        <span>·</span>
        <span className="text-ink-dim">{lesson.title}</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{lesson.title}</h1>
      <p className="mt-1.5 max-w-2xl text-[15px] leading-7 text-ink-dim">{lesson.blurb}</p>
      <div className="mt-3">
        <ServiceStatus service={runner.service} />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        {/* The reading */}
        <article className="min-w-0 space-y-4">
          {lesson.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
          {lesson.lesson && (
            <Link
              to={lesson.lesson}
              className="inline-block text-sm text-cyan transition-colors hover:text-ink"
            >
              The quantum lesson behind this →
            </Link>
          )}
        </article>

        {/* The doing */}
        <section className="min-w-0 space-y-3">
          <div className="card overflow-hidden border-violet/40">
            <div className="border-b border-violet/25 bg-violet/[0.04] px-3 py-2">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-violet">
                Your turn
              </div>
              <p className="mt-1.5 text-sm leading-6 text-ink">
                <RichText text={lesson.task.prompt} />
              </p>
            </div>

            <CodeEditor value={code} onChange={setCode} onSubmit={check} minHeight="300px" />

            <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
              <button
                onClick={check}
                disabled={runner.busy}
                className="rounded-md border border-violet bg-violet/10 px-4 py-1 text-sm text-violet transition-colors hover:bg-violet/20 disabled:opacity-50"
              >
                {runner.busy ? 'Running…' : 'Run and check'}
              </button>
              <button
                onClick={() => setShowHint((v) => !v)}
                className="text-xs text-ink-faint transition-colors hover:text-ink"
              >
                {showHint ? 'Hide hint' : 'Hint'}
              </button>
              <button
                onClick={() => {
                  setCode(lesson.task.starter)
                  setVerdict(undefined)
                  runner.reset()
                }}
                className="ml-auto text-xs text-ink-faint transition-colors hover:text-ink"
              >
                Reset
              </button>
            </div>

            {showHint && (
              <p className="border-t border-line px-3 py-2 text-xs leading-5 text-ink-faint">
                {lesson.task.hint}
              </p>
            )}

            {verdict && (
              <p
                role="status"
                className={`border-t px-3 py-2 text-sm leading-6 ${
                  verdict.correct
                    ? 'border-emerald/30 bg-emerald/5 text-emerald'
                    : 'border-amber/30 bg-amber/5 text-amber'
                }`}
              >
                {verdict.message}
              </p>
            )}
          </div>

          <Output run={runner.run} failure={runner.failure} />
          {runner.circuit && <ResultCircuit result={runner.circuit} notes={runner.notes} />}
        </section>
      </div>

      <nav className="mt-10 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:justify-between">
        {previous ? (
          <Link
            to={`/python/${previous.slug}`}
            className="group rounded-lg border border-line px-4 py-3 transition-colors hover:border-cyan sm:max-w-[48%]"
          >
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">Previous</div>
            <div className="text-sm text-ink group-hover:text-cyan">← {previous.title}</div>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to={`/python/${next.slug}`}
            className="group rounded-lg border border-line px-4 py-3 text-right transition-colors hover:border-cyan sm:max-w-[48%]"
          >
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">Next</div>
            <div className="text-sm text-ink group-hover:text-cyan">{next.title} →</div>
          </Link>
        ) : (
          <Link
            to="/python/playground"
            className="group rounded-lg border border-emerald/40 px-4 py-3 text-right transition-colors hover:bg-emerald/5 sm:max-w-[48%]"
          >
            <div className="text-[11px] uppercase tracking-wider text-ink-faint">Last lesson</div>
            <div className="text-sm text-emerald">Open the playground →</div>
          </Link>
        )}
      </nav>
    </div>
  )
}

function Block({ block }: { block: LessonBlock }) {
  if (block.kind === 'text') {
    return (
      <p className="text-[15px] leading-7 text-ink-dim">
        <RichText text={block.text} />
      </p>
    )
  }

  if (block.kind === 'note') {
    return (
      <div className="rounded-r border-l-2 border-l-cyan bg-surface/60 px-3 py-2 text-sm leading-6 text-ink-dim">
        <RichText text={block.text} />
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-ground/60">
      <CodeEditor value={block.code} readOnly minHeight="0" ariaLabel="Example code" />
      {block.caption && (
        <figcaption className="border-t border-line px-3 py-1.5 text-[11px] text-ink-faint">
          <RichText text={block.caption} />
        </figcaption>
      )}
    </figure>
  )
}
