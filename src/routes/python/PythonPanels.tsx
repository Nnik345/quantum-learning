import { useState } from 'react'
import { Link } from 'react-router-dom'

import { START_COMMAND, type PythonHealth, type PythonRun } from '../../lib/python/client'
import type { ValidationResult } from '../../lib/llm/validate'
import { CircuitGrid } from '../../circuit/CircuitGrid'
import { requestLoad, isBoardMounted } from '../../circuit/circuitBridge'

const noop = () => {}

/** Whether the service is up, or how to start it. Shared by the playground and the lessons. */
export function ServiceStatus({ service }: { service?: PythonHealth }) {
  if (!service) return null

  if (service.ok) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs text-ink-faint">
          <span className="text-emerald">●</span> Qiskit {service.qiskit} on Python {service.python}
          {service.timeoutSeconds ? ` · ${service.timeoutSeconds}s limit per run` : ''}
          {service.sandboxed && ' · sandboxed'}
        </p>
        {service.sandboxed === false && (
          /*
           * Worth interrupting for. Unsandboxed means anything typed here runs with the host user's
           * permissions — fine alone on your own machine, not fine on a page shared with others.
           */
          <div className="max-w-2xl rounded-lg border border-rose/40 bg-rose/5 px-3 py-2 text-xs leading-5 text-rose">
            <strong className="font-semibold">Not sandboxed.</strong> Code run here can read and write
            the host&rsquo;s files and reach the network.
            {service.sandboxDetail ? ` ${service.sandboxDetail}.` : ''} Install bubblewrap and restart
            the service before sharing this page with anyone.
          </div>
        )}
      </div>
    )
  }

  // Not running is the ordinary first-visit state, so it reads as an instruction, not an error.
  return (
    <div className="max-w-2xl rounded-lg border border-amber/40 bg-amber/5 px-3 py-2 text-xs leading-5 text-amber">
      The Python service is not running. Start it in a terminal with{' '}
      <span className="font-mono text-ink">{START_COMMAND}</span>, then reload. Setup instructions are
      in <span className="font-mono text-ink">pyserver/README.md</span>.
    </div>
  )
}

/** Everything the program printed, plus any traceback. */
export function Output({ run, failure }: { run?: PythonRun; failure?: string }) {
  if (failure) {
    return (
      <div className="rounded-lg border border-rose/40 bg-rose/5 px-3 py-2 font-mono text-xs leading-5 text-rose">
        {failure}
      </div>
    )
  }
  if (!run) return null

  const empty = !run.stdout && !run.stderr && !run.error

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-xs font-medium text-ink-dim">Output</span>
        <span className="font-mono text-[11px] text-ink-faint">{run.durationMs} ms</span>
      </div>
      <div className="max-h-[360px] overflow-auto px-3 py-2.5">
        {empty && <p className="text-xs text-ink-faint">Ran without printing anything.</p>}
        {run.stdout && (
          <pre className="overflow-x-auto whitespace-pre font-mono text-xs leading-5 text-ink">
            {run.stdout}
          </pre>
        )}
        {run.stderr && (
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-ink-faint">
            {run.stderr}
          </pre>
        )}
        {run.error && (
          <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-5 text-rose">
            {run.error}
          </pre>
        )}
      </div>
    </div>
  )
}

/** The circuit the program built, drawn in this site's wire order and offered to the board. */
export function ResultCircuit({ result, notes }: { result: ValidationResult; notes: string[] }) {
  const [loaded, setLoaded] = useState(false)

  if (!result.circuit || !result.ok) {
    return (
      <div className="card px-3 py-2.5 text-xs leading-5 text-amber">
        Python built a circuit this board cannot draw: {result.errors.join('; ')}
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2 text-xs font-medium text-ink-dim">
        Your circuit, in this site&rsquo;s order
      </div>

      <div className="overflow-x-auto p-2">
        <div className="pointer-events-none w-max origin-top-left scale-90">
          <CircuitGrid
            circuit={result.circuit}
            drag={null}
            hover={null}
            inspectStep={result.circuit.columns}
            onSelect={noop}
            onInspectStep={noop}
            onGatePointerDown={noop}
            onControlHandlePointerDown={noop}
            onBackgroundPointerDown={noop}
            onEditInput={noop}
          />
        </div>
      </div>

      <div className="border-t border-line px-3 py-2">
        {result.outcome && (
          <div className="font-mono text-[11px] text-ink-dim">{result.outcome.dirac}</div>
        )}
        <p className="mt-1.5 text-[10px] leading-4 text-ink-faint">
          Qiskit numbers qubits from the right and this site from the left, so the wires are
          mirrored. Both then describe the same state and print the same bitstring.
        </p>
        {notes.length > 0 && (
          <p className="mt-1.5 text-[10px] leading-4 text-amber">{notes.join(' ')}</p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => {
              requestLoad(result.circuit!)
              setLoaded(true)
            }}
            className="rounded border border-cyan px-2 py-0.5 text-[11px] text-cyan transition-colors hover:bg-cyan/10"
          >
            Load into Circuit Lab
          </button>
          {loaded && !isBoardMounted() && (
            <Link to="/circuit" className="text-[11px] text-cyan hover:underline">
              open the lab →
            </Link>
          )}
          {loaded && isBoardMounted() && (
            <span className="text-[10px] text-ink-faint">loaded — Ctrl+Z to undo</span>
          )}
        </div>
      </div>
    </div>
  )
}
