/**
 * Talking to the local Python service.
 *
 * Same shape as the Ollama client: the browser only ever calls a same-origin path, and Vite proxies
 * it to a process on this machine. No CORS to configure, and it tunnels over SSH unchanged.
 */

import type { QiskitCircuit } from './qiskitOrder'

/**
 * Proxied by Vite to PY_URL (default http://localhost:8000).
 *
 * Not `/py`: Vite matches proxy rules by prefix, so `/py` would also capture the `/python` page and
 * serve the service's 502 in place of the app.
 */
export const PY_BASE = '/pyserver'

export interface PythonHealth {
  ok: boolean
  qiskit?: string
  python?: string
  timeoutSeconds?: number
  /** Whether submitted code runs inside bubblewrap. False means it runs with the host's permissions. */
  sandboxed?: boolean
  /** Why the sandbox is off, when it is. */
  sandboxDetail?: string
  /** Every installed distribution as "name==version", so the tutor writes against what exists. */
  packages?: string[]
  error?: string
}

export interface PythonRun {
  stdout: string
  stderr: string
  error?: string | null
  circuit?: QiskitCircuit | null
  circuitError?: string | null
  durationMs: number
}

/** How to start the service, quoted back to the reader when it is not answering. */
export const START_COMMAND = 'python pyserver/server.py'

export class PythonUnavailable extends Error {
  constructor() {
    super(`The Python service is not running. Start it with:  ${START_COMMAND}`)
    this.name = 'PythonUnavailable'
  }
}

/** Is the service up, and can it import Qiskit? Never throws — an unreachable service is a state. */
export async function health(signal?: AbortSignal): Promise<PythonHealth> {
  try {
    const response = await fetch(`${PY_BASE}/health`, { signal })
    if (!response.ok) return { ok: false, error: `Service replied ${response.status}.` }
    return (await response.json()) as PythonHealth
  } catch {
    return { ok: false, error: new PythonUnavailable().message }
  }
}

/**
 * Run a script and return everything it produced.
 *
 * Throws only when the service cannot be reached; a script that raises is a normal result with an
 * `error` field, because a traceback is an outcome the learner needs to read, not a failure here.
 */
export async function runPython(code: string, signal?: AbortSignal): Promise<PythonRun> {
  let response: Response
  try {
    response = await fetch(`${PY_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    throw new PythonUnavailable()
  }

  if (!response.ok) {
    throw new Error(`The Python service replied ${response.status}. Check the terminal running it.`)
  }
  return (await response.json()) as PythonRun
}
