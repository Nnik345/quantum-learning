/** Retrieval, tool dispatch, the system prompt, and the streaming parser — none of it needs Ollama. */

import { describe, it, expect } from 'vitest'

import { searchContent, topicToText, topicBySlug, contentsOutline, terms } from './retrieval'
import { dispatchTool, TOOL_DEFINITIONS } from './tools'
import { buildSystemPrompt, estimateTokens } from './systemPrompt'
import { parseLine, OllamaClient } from './client'
import { ALLOWED_GATES, ALLOWED_INPUTS, CIRCUIT_SCHEMA } from './schema'
import { getPreset } from '../quantum/presets'
import { createCircuit, type Circuit } from '../quantum/circuit'
import { MAX_QUBITS } from '../quantum/state'

// --- retrieval -------------------------------------------------------------

describe('retrieval', () => {
  const top = (q: string, slug?: string) => searchContent(q, { limit: 2, currentSlug: slug })[0]?.slug

  it('finds the topic that actually explains each concept', () => {
    const cases: [string, string][] = [
      ['what is phase kickback', 'deutsch'],
      ['how do I normalise a state', 'dirac-notation'],
      ['explain the diffuser', 'grovers-search'],
      ['what is a tensor product', 'tensor-products'],
      ['how do eigenvalues relate to measurement', 'eigenvalues-and-eigenvectors'],
      ['shor factoring', 'shors-algorithm'],
      ['why must gates be unitary', 'quantum-gates'],
      ['what is shot noise', 'probability'],
      ['teleportation', 'quantum-teleportation'],
      ['roots of unity', 'complex-numbers'],
    ]
    for (const [query, expected] of cases) {
      expect(`${query} -> ${top(query)}`).toBe(`${query} -> ${expected}`)
    }
  })

  it('prefers a heading quoted verbatim over a merely common word', () => {
    // "phase" is far more frequent in Phase Estimation, but the heading lives in Deutsch.
    expect(top('phase kickback')).toBe('deutsch')
  })

  it('boosts the page the reader is on', () => {
    // A vague question resolves to wherever they are standing.
    expect(top('explain this', 'grovers-search')).toBe('grovers-search')
    expect(top('explain this', 'measurement')).toBe('measurement')
  })

  it('returns nothing for an unrelated question', () => {
    expect(searchContent('best pasta recipe')).toEqual([])
  })

  it('renders a topic as text with its headings', () => {
    const text = topicToText(
      (topicBySlug('grovers-search') && { title: '', blurb: '', slug: '', sections: [] }) as never,
    )
    expect(typeof text).toBe('string')

    const grover = topicBySlug('grovers-search')!
    expect(grover.text).toMatch(/^# Grover/)
    expect(grover.text).toMatch(/## Amplitude Amplification/)
    expect(grover.text).toMatch(/worked circuit: preset "grover"/)
  })

  it('strips maths out of the index terms', () => {
    expect(terms('the modulus $|\\alpha|^2$ of an amplitude')).not.toContain('alpha')
  })

  it('lists every topic in the outline', () => {
    const outline = contentsOutline()
    expect(outline).toMatch(/Basic Maths:/)
    expect(outline).toMatch(/\/algorithms\/shors-algorithm/)
    expect(outline.split('\n')).toHaveLength(3)
  })
})

// --- system prompt ---------------------------------------------------------

describe('system prompt', () => {
  it('states the ordering convention and warns about Qiskit', () => {
    const p = buildSystemPrompt()
    expect(p).toMatch(/q0 is the TOP wire/)
    expect(p).toMatch(/REVERSE of Qiskit/)
    expect(p).toMatch(/\|100>, never \|001>/)
  })

  it('states the platform limits the model cannot infer', () => {
    const p = buildSystemPrompt()
    expect(p).toMatch(new RegExp(`At most ${MAX_QUBITS} qubits`))
    expect(p).toMatch(/NO classical feedforward/)
    expect(p).toMatch(/deferred/)
  })

  it('lists the real gate set, derived from the palette', () => {
    const p = buildSystemPrompt()
    for (const gate of ['H', 'SWAP', 'MEASURE', 'RX']) expect(p).toContain(gate)
  })

  it('tells the model where the reader is', () => {
    const p = buildSystemPrompt({ path: '/algorithms/grovers-search', topicTitle: 'Grover’s Search' })
    expect(p).toMatch(/Grover’s Search/)
    expect(p).toMatch(/assume they mean this page/)
  })

  it('stays small enough to leave room for content', () => {
    expect(estimateTokens(buildSystemPrompt({ path: '/x', topicTitle: 'Y', hasCircuit: true }))).toBeLessThan(1500)
  })
})

// --- tool definitions ------------------------------------------------------

describe('tool definitions', () => {
  it('exposes exactly the four read-only tools', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.function.name)).toEqual([
      'search_content',
      'propose_circuit',
      'get_current_circuit',
      'run_simulation',
    ])
  })

  it('derives the gate enum from the real palette so they cannot drift', () => {
    expect(ALLOWED_GATES).toContain('H')
    expect(ALLOWED_GATES).toContain('MEASURE')
    expect(ALLOWED_GATES).not.toContain('CNOT') // a CNOT is X with a control
    expect(ALLOWED_INPUTS).toEqual(['0', '1', '+', '-', 'i', '-i'])
  })

  it('caps the schema at the simulator’s qubit limit', () => {
    const props = CIRCUIT_SCHEMA.properties as Record<string, { maximum?: number }>
    expect(props.numQubits.maximum).toBe(MAX_QUBITS)
  })
})

// --- dispatch --------------------------------------------------------------

describe('tool dispatch', () => {
  const bellCircuit = getPreset('bell')!.circuit

  it('search_content returns site text', async () => {
    const r = await dispatchTool('search_content', { query: 'grover diffuser' })
    expect(r.content).toMatch(/from \/algorithms\/grovers-search/)
    expect(r.content).toMatch(/reflect/i)
  })

  it('search_content says so when nothing matches', async () => {
    const r = await dispatchTool('search_content', { query: 'pasta recipe' })
    expect(r.content).toMatch(/Nothing on the site covers that/)
  })

  it('propose_circuit validates and reports the computed result', async () => {
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: [
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'X', targets: [1], controls: [0], column: 1 },
      ],
    })
    expect(r.content).toMatch(/^ACCEPTED/)
    expect(r.content).toMatch(/0\.707\|00⟩/)
    expect(r.circuit?.ok).toBe(true)
  })

  it('propose_circuit hands back a fixable reason on rejection', async () => {
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: [{ gate: 'FAKE', targets: [0], column: 0 }],
    })
    expect(r.content).toMatch(/^REJECTED/)
    expect(r.circuit?.ok).toBe(false)
  })

  it('get_current_circuit describes the board', async () => {
    const r = await dispatchTool('get_current_circuit', {}, { currentCircuit: bellCircuit })
    expect(r.content).toMatch(/2 qubits, 2 gates/)
    expect(r.content).toMatch(/controlled by q0/)
    expect(r.content).toMatch(/Entangled qubits: q0, q1/)
  })

  it('get_current_circuit copes with an empty board', async () => {
    const r = await dispatchTool('get_current_circuit', {}, { currentCircuit: createCircuit(3) })
    expect(r.content).toMatch(/board is empty/)
  })

  it('run_simulation returns exact numbers, not prose', async () => {
    const r = await dispatchTool('run_simulation', {}, { currentCircuit: bellCircuit })
    expect(r.content).toMatch(/00 50\.00%/)
    expect(r.content).toMatch(/q0 \(0\.000, 0\.000, 0\.000\) \|r\|=0\.000/)
  })

  it('run_simulation can sample shots', async () => {
    const r = await dispatchTool('run_simulation', { shots: 200 }, { currentCircuit: bellCircuit })
    expect(r.content).toMatch(/Sampled 200 shots/)
    expect(r.content).toMatch(/00 x\d+/)
  })

  it('reports non-default inputs', async () => {
    const withInput: Circuit = {
      ...createCircuit(2),
      inputs: [{ preset: '+' }, { preset: '0' }],
      placements: [{ id: 'a', gate: 'H', targets: [0], controls: [], params: [], column: 0 }],
    }
    const r = await dispatchTool('get_current_circuit', {}, { currentCircuit: withInput })
    expect(r.content).toMatch(/Non-default inputs: q0=\+/)
  })

  it('an unknown tool name is reported, not thrown', async () => {
    const r = await dispatchTool('rm_rf', {})
    expect(r.content).toMatch(/no tool called/)
  })

  it('never throws on malformed arguments', async () => {
    for (const name of TOOL_DEFINITIONS.map((t) => t.function.name)) {
      await expect(dispatchTool(name, { junk: Symbol('x') as never })).resolves.toBeDefined()
    }
  })
})

// --- streaming parser ------------------------------------------------------

describe('stream parsing', () => {
  it('separates thinking from content', () => {
    const thinking = parseLine('{"message":{"thinking":"hmm"},"done":false}')
    expect(thinking?.thinking).toBe('hmm')
    expect(thinking?.content).toBeUndefined()

    const content = parseLine('{"message":{"content":"hello"},"done":false}')
    expect(content?.content).toBe('hello')
    expect(content?.thinking).toBeUndefined()
  })

  it('extracts tool calls', () => {
    const chunk = parseLine(
      '{"message":{"tool_calls":[{"function":{"name":"search_content","arguments":{"query":"x"}}}]},"done":false}',
    )
    expect(chunk?.toolCalls?.[0].function.name).toBe('search_content')
  })

  it('reports stats on the final chunk', () => {
    const chunk = parseLine('{"done":true,"eval_count":120,"total_duration":3000000000}')
    expect(chunk?.done).toBe(true)
    expect(chunk?.stats?.evalTokens).toBe(120)
    expect(chunk?.stats?.totalMs).toBe(3000)
  })

  it('ignores an unparseable line rather than killing the stream', () => {
    expect(parseLine('{not json')).toBeUndefined()
    expect(parseLine('')).toBeUndefined()
  })

  it('surfaces a daemon error', () => {
    expect(() => parseLine('{"error":"model not found"}')).toThrow(/model not found/)
  })
})

describe('client configuration', () => {
  it('defaults to the proxy path in a browser', () => {
    // jsdom provides `window`, so this exercises the browser branch.
    expect(new OllamaClient().baseUrl).toBe('/ollama')
  })

  it('accepts an explicit base URL and model', () => {
    const c = new OllamaClient({ baseUrl: 'http://localhost:11434/', model: 'other' })
    expect(c.baseUrl).toBe('http://localhost:11434')
    expect(c.model).toBe('other')
  })

  it('reports a clear error when the daemon is unreachable', async () => {
    const c = new OllamaClient({ baseUrl: 'http://127.0.0.1:1' })
    const health = await c.health(500)
    expect(health.ok).toBe(false)
    expect(health.error).toMatch(/Could not reach Ollama|did not respond/)
  })
})
