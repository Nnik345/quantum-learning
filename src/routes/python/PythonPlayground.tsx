import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PYTHON_EXAMPLES, type PythonExample } from '../../content/pythonExamples'
import { usePythonRunner } from '../../lib/python/useRunner'
import { CodeEditor } from '../../components/editor/CodeEditor'
import { Output, ResultCircuit, ServiceStatus } from './PythonPanels'
import { publishPython, unpublishPython, takePendingCode } from '../../lib/python/pythonBridge'

/**
 * An open editor with nothing to prove.
 *
 * The guide teaches; this is where you go once you want to try something of your own. Same runner
 * and the same conversion, so a circuit built here reaches the board exactly as one built in a
 * lesson does.
 */
export function PythonPlayground() {
  const [code, setCode] = useState(PYTHON_EXAMPLES[0].code)
  const runner = usePythonRunner()

  // Collect anything the tutor offered while no editor was open.
  useEffect(() => {
    const parked = takePendingCode()
    if (parked) setCode(parked)
  }, [])

  // Keep the tutor's view of the editor current, so "why does my code fail?" can be answered.
  useEffect(() => {
    publishPython(
      {
        code,
        where: 'playground',
        stdout: runner.run?.stdout,
        stderr: runner.run?.stderr,
        error: runner.run?.error ?? undefined,
      },
      setCode,
    )
    return unpublishPython
  }, [code, runner.run])

  const load = (example: PythonExample) => {
    setCode(example.code)
    runner.reset()
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <header className="mb-5">
        <nav className="mb-2 text-xs text-ink-faint">
          <Link to="/python" className="hover:text-cyan">
            Python
          </Link>
          <span> / </span>
          <span className="text-ink-dim">Playground</span>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-dim">
          Real Qiskit, running on this machine, with nothing to get right. Load whatever circuit you
          build onto the board — the wire order is converted so Qiskit&rsquo;s output and this
          site&rsquo;s panels agree.
        </p>
        <div className="mt-2">
          <ServiceStatus service={runner.service} />
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 space-y-3">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
              <span className="text-xs font-medium text-ink-dim">Your code</span>
              <button
                onClick={() => runner.execute(code)}
                disabled={runner.busy}
                className="rounded-md border border-cyan bg-cyan/10 px-4 py-1 text-sm font-medium text-cyan transition-colors hover:bg-cyan/20 disabled:opacity-50"
              >
                {runner.busy ? 'Running…' : 'Run'}
              </button>
            </div>

            <CodeEditor
              value={code}
              onChange={setCode}
              onSubmit={() => runner.execute(code)}
              minHeight="420px"
            />

            <div className="border-t border-line px-3 py-1.5 text-[11px] text-ink-faint">
              Ctrl+Enter to run. Leave your circuit in a variable called{' '}
              <span className="font-mono text-ink-dim">circuit</span> to load it onto the board.
            </div>
          </div>

          <Output run={runner.run} failure={runner.failure} />
        </section>

        <aside className="min-w-0 space-y-3">
          {runner.circuit && <ResultCircuit result={runner.circuit} notes={runner.notes} />}

          <div className="card p-3">
            <div className="mb-2 text-xs font-medium text-ink-dim">Start from an example</div>
            <div className="space-y-2">
              {PYTHON_EXAMPLES.map((example) => (
                <div key={example.id} className="rounded-lg border border-line bg-ground/40 p-2.5">
                  <button
                    onClick={() => load(example)}
                    className="text-left text-sm font-medium text-ink transition-colors hover:text-cyan"
                  >
                    {example.title}
                  </button>
                  <p className="mt-1 text-[11px] leading-4 text-ink-faint">{example.blurb}</p>
                  {example.lesson && (
                    <Link
                      to={example.lesson}
                      className="mt-1.5 inline-block text-[11px] text-cyan hover:underline"
                    >
                      read the lesson →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-3">
            <p className="text-xs leading-5 text-ink-dim">
              New to Qiskit? The{' '}
              <Link to="/python" className="text-cyan hover:underline">
                six-lesson guide
              </Link>{' '}
              walks through it, and checks the code you write.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
