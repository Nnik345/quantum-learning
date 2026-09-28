/**
 * The site as ground truth.
 *
 * Two things are under test here. First, that a verified circuit is reachable by name from anywhere,
 * because the Grover failure was the model building from memory while a tested Grover sat in the
 * codebase. Second, that `compareTo` actually catches that specific failure — the doubled
 * controlled-Z whose oracle cancels itself out.
 */

import { describe, it, expect } from 'vitest'

import { dispatchTool, findPreset, newTurn, pagePath, TOOL_DEFINITIONS, type PageRef } from './tools'
import { validateProposal, toProposal, describeOutcome } from './validate'
import { searchCircuits, searchContent, presetPage } from './retrieval'
import { isInternalPath } from '../../assistant/links'
import { buildSystemPrompt, estimateTokens, MAX_SYSTEM_PROMPT_TOKENS } from './systemPrompt'
import { ALGORITHM_PRESETS, getPreset } from '../quantum/presets'

describe('reference circuits are reachable by name', () => {
  it('describes every one of the twelve with gates, outcome and a page link', async () => {
    for (const preset of ALGORITHM_PRESETS) {
      const r = await dispatchTool('get_reference_circuit', { name: preset.id })
      expect(r.content, preset.id).toMatch(/^SITE CIRCUIT/)
      expect(r.content, preset.id).toContain(`"${preset.id}"`)
      // The gates arrive in the exact format propose_circuit takes, not as prose to retype.
      expect(r.content, preset.id).toContain(JSON.stringify(toProposal(preset.circuit)))
      expect(r.content, preset.id).toMatch(/Produces:/)
      // The page link matters: a citation the model cannot verify is worse than none.
      const page = presetPage(preset.id)
      expect(page, `${preset.id} should be printed on some page`).toBeDefined()
      expect(r.content).toContain(`/${page!.trackId}/${page!.slug}`)
    }
  })

  it('matches by name and loose phrasing, not just by id', () => {
    expect(findPreset('grover')?.id).toBe('grover')
    expect(findPreset("Grover's Search")?.id).toBe('grover')
    expect(findPreset('grovers search')?.id).toBe('grover')
    expect(findPreset('GROVER')?.id).toBe('grover')
    expect(findPreset('teleportation')?.id).toBe('teleportation')
  })

  it('lists everything available when called blind, so the model can discover what exists', async () => {
    for (const args of [{}, { name: '' }, { name: 'travelling salesman' }]) {
      const r = await dispatchTool('get_reference_circuit', args)
      for (const preset of ALGORITHM_PRESETS) expect(r.content, JSON.stringify(args)).toContain(preset.id)
    }
  })

  it('is advertised to the model', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.function.name)
    expect(names).toContain('get_reference_circuit')
    expect(names).toContain('open_topic')
  })
})

describe('open_topic fetches a page by name', () => {
  it('resolves by slug and reports where it sits on the path', async () => {
    const r = await dispatchTool('open_topic', { name: 'grovers-search' })
    expect(r.content).toContain('/algorithms/grovers-search')
    expect(r.content).toMatch(/step \d+/i)
  })

  it('resolves by title as written on the page', async () => {
    // A straight apostrophe, which is what the model will write; the page uses a typographic one.
    const r = await dispatchTool('open_topic', { name: "Grover's Search" })
    expect(r.content).toContain('/algorithms/grovers-search')
  })

  it('fails informatively rather than silently', async () => {
    const r = await dispatchTool('open_topic', { name: 'quantum gastronomy' })
    expect(r.content).toMatch(/No page/i)
    // Sharing the word "quantum" with a real title is not a match.
    expect(r.content).not.toMatch(/Born rule/)
    // Naming the alternatives is what turns a dead end into a usable answer.
    expect(r.content).toContain('/algorithms/grovers-search')
  })
})

describe('compareTo catches the failure it exists for', () => {
  const verifiedGrover = getPreset('grover')!.circuit.placements
    .filter((p) => p.gate !== 'M')
    .sort((a, b) => a.column - b.column)
    .map((p) => ({ gate: p.gate, targets: p.targets, controls: p.controls, column: p.column }))

  it('reports a match for the site Grover', async () => {
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: verifiedGrover,
      compareTo: 'grover',
    })
    expect(r.content).toMatch(/^ACCEPTED/)
    expect(r.content).toMatch(/same result as the site's "grover" circuit/)
    expect(r.circuit?.ok).toBe(true)
  })

  it('reports a difference for the doubled controlled-Z that originally failed', async () => {
    // One CZ written once per wire is the same gate twice; it cancels, and the marking vanishes.
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: [
        { gate: 'H', targets: [0], column: 0 },
        { gate: 'H', targets: [1], column: 0 },
        { gate: 'Z', targets: [1], controls: [0], column: 1 },
        { gate: 'Z', targets: [0], controls: [1], column: 1 },
      ],
      compareTo: 'grover',
    })
    expect(r.content).toMatch(/the site's "grover" circuit produces/)
    // Points at the tool that removes the need to rebuild at all.
    expect(r.content).toMatch(/show_reference_circuit/)
  })

  it('marks the check as private, so it is not repeated to the reader', async () => {
    // Worded as a verdict, the model passed it on: "I verified this against the website".
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: verifiedGrover,
      compareTo: 'grover',
    })
    expect(r.content).toMatch(/Internal check, not for the reader/)
    expect(r.content).not.toMatch(/verified/i)
  })

  it('stays quiet when no reference is named', async () => {
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: [{ gate: 'H', targets: [0], column: 0 }],
    })
    expect(r.content).not.toMatch(/Internal check/)
  })
})

describe('circuits are indexed alongside the prose', () => {
  it('surfaces the verified circuit for a circuit-shaped query', async () => {
    expect(searchCircuits('teleportation circuit').map((c) => c.preset.id)).toContain('teleportation')
    const r = await dispatchTool('search_content', { query: 'show me a teleportation circuit' })
    expect(r.content).toMatch(/teleportation/)
  })

  it('does not inject circuit noise into a conceptual question', () => {
    expect(searchCircuits('why must gates be unitary')).toHaveLength(0)
  })

  it('never displaces the lesson text', async () => {
    const r = await dispatchTool('search_content', { query: 'why must gates be unitary' })
    expect(r.content).toMatch(/from \/(theory|math)\//)
  })
})

describe('the prompt fits, and says what it must', () => {
  it('stays within budget with page context attached', () => {
    const full = buildSystemPrompt({
      path: '/algorithms/grovers-search',
      topicTitle: "Grover's Search",
      hasCircuit: true,
    })
    expect(estimateTokens(full)).toBeLessThanOrEqual(MAX_SYSTEM_PROMPT_TOKENS)
  })

  it('tells the model to show the site circuit, keep its working private, and cite pages', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/NAMED algorithm[\s\S]*show_reference_circuit/)
    expect(prompt).toMatch(/never rebuild one from memory/)
    expect(prompt).toMatch(/earlier attempts are your working[\s\S]*never\s+mention them/)
    expect(prompt).toMatch(/CITE the page/)
    // The catalogue lets it name a circuit without a discovery round-trip.
    for (const preset of ALGORITHM_PRESETS) expect(prompt).toContain(preset.id)
  })
})

/**
 * Deutsch as the live model built it once: every gate right, but the |1⟩ ancilla left out, so q0
 * measures 0 and the algorithm answers "constant" for a balanced oracle.
 */
const deutschGates = [
  { gate: 'H', targets: [0], column: 0 },
  { gate: 'H', targets: [1], column: 0 },
  { gate: 'X', targets: [1], controls: [0], column: 1 },
  { gate: 'H', targets: [0], column: 2 },
  { gate: 'MEASURE', targets: [0], column: 3 },
]

describe('the comparison happens whether or not the model asks for it', () => {
  /*
   * Measured against the live model on "build a Deutsch circuit": it looked the reference up every
   * time and then skipped compareTo in a quarter of the turns — and one of those skipped turns is
   * the circuit above. Nothing marked it, because nothing checked.
   */
  it('catches the missing ancilla that reached a reader', async () => {
    const turn = newTurn()
    await dispatchTool('get_reference_circuit', { name: 'deutsch' }, { turn })
    const r = await dispatchTool('propose_circuit', { numQubits: 2, gates: deutschGates }, { turn })

    expect(r.circuit?.outcome?.dirac).toBe('0.707|00⟩ + 0.707|01⟩')
    expect(r.content).toMatch(/the site's "deutsch" circuit produces 0\.707\|10⟩/)
  })

  it('confirms the same circuit once the ancilla is right', async () => {
    const turn = newTurn()
    await dispatchTool('get_reference_circuit', { name: 'deutsch' }, { turn })
    const r = await dispatchTool(
      'propose_circuit',
      { numQubits: 2, gates: deutschGates, inputs: ['0', '1'] },
      { turn },
    )

    expect(r.content).toMatch(/same result as the site's "deutsch" circuit/)
  })

  it('leaves room to build something else on purpose', async () => {
    // A reader can ask for a variant. The model is told what differs and that changing it on
    // purpose is fine, rather than being pushed to "correct" a circuit that was what was asked for.
    const turn = newTurn()
    await dispatchTool('get_reference_circuit', { name: 'deutsch' }, { turn })
    const r = await dispatchTool('propose_circuit', { numQubits: 2, gates: deutschGates }, { turn })

    expect(r.content).toMatch(/if you are deliberately changing it, carry on/)
  })

  it('prefers the reference the model named over the one it looked up', async () => {
    const turn = newTurn()
    await dispatchTool('get_reference_circuit', { name: 'deutsch' }, { turn })
    const r = await dispatchTool(
      'propose_circuit',
      {
        numQubits: 2,
        gates: [
          { gate: 'H', targets: [0], column: 0 },
          { gate: 'X', targets: [1], controls: [0], column: 1 },
        ],
        compareTo: 'bell',
      },
      { turn },
    )

    expect(r.content).toMatch(/same result as the site's "bell" circuit/)
    expect(r.content).not.toMatch(/deutsch/)
  })

  it('does not carry a reference from one question into the next', async () => {
    // Two questions about two algorithms must not be compared against each other.
    const first = newTurn()
    await dispatchTool('get_reference_circuit', { name: 'deutsch' }, { turn: first })

    const second = newTurn()
    const r = await dispatchTool('propose_circuit', { numQubits: 2, gates: deutschGates }, { turn: second })
    expect(r.content).not.toMatch(/Internal check/)
  })

  it('remembers nothing from a request to list what exists', async () => {
    // Listing the catalogue names no particular circuit, so there is nothing to compare against.
    const turn = newTurn()
    await dispatchTool('get_reference_circuit', {}, { turn })
    const r = await dispatchTool('propose_circuit', { numQubits: 2, gates: deutschGates }, { turn })
    expect(r.content).not.toMatch(/Internal check/)
  })
})

describe('every tool that reads the site says which page it read', () => {
  /*
   * So the answer can end by pointing the reader there. Left to the model, citing is hit and miss;
   * the code knows exactly where each piece of text came from.
   */
  const paths = (r: { sources?: PageRef[] }) => (r.sources ?? []).map(pagePath)

  it('search_content reports the lesson pages it returned', async () => {
    const r = await dispatchTool('search_content', { query: 'amplitude amplification diffuser' })
    const expected = searchContent('amplitude amplification diffuser', { limit: 2 }).map(
      (h) => `/${h.trackId}/${h.slug}`,
    )
    expect(expected.length).toBeGreaterThan(0)
    expect(paths(r)).toEqual(expected)
  })

  it('open_topic, and the reference tools, report the page they came from', async () => {
    expect(paths(await dispatchTool('open_topic', { name: 'Deutsch’s Algorithm' }))).toEqual([
      '/algorithms/deutsch',
    ])
    expect(paths(await dispatchTool('show_reference_circuit', { name: 'deutsch' }))).toEqual([
      '/algorithms/deutsch',
    ])
    expect(paths(await dispatchTool('get_reference_circuit', { name: 'deutsch' }))).toEqual([
      '/algorithms/deutsch',
    ])
    expect(paths(await dispatchTool('run_simulation', { preset: 'deutsch' }))).toEqual([
      '/algorithms/deutsch',
    ])
  })

  it('get_current_page reports the page the reader is on', async () => {
    const r = await dispatchTool('get_current_page', {}, { currentSlug: 'deutsch' })
    expect(paths(r)).toEqual(['/algorithms/deutsch'])
  })

  it('reports nothing when it found nothing, so no dead pointer is offered', async () => {
    expect(paths(await dispatchTool('open_topic', { name: 'quantum gastronomy' }))).toEqual([])
    expect(paths(await dispatchTool('show_reference_circuit', { name: 'quantum gastronomy' }))).toEqual([])
    expect(paths(await dispatchTool('search_content', { query: 'zxqv' }))).toEqual([])
  })

  it('only ever points at pages that exist', async () => {
    for (const preset of ALGORITHM_PRESETS) {
      const r = await dispatchTool('show_reference_circuit', { name: preset.id })
      for (const path of paths(r)) expect(isInternalPath(path), `${preset.id} → ${path}`).toBe(true)
    }
    for (const query of ['superposition', 'entanglement', 'measurement', 'phase kickback', 'Shor']) {
      const r = await dispatchTool('search_content', { query })
      for (const path of paths(r)) expect(isInternalPath(path), `${query} → ${path}`).toBe(true)
    }
  })
})

describe('named algorithms reach the reader as the site has them', () => {
  /*
   * The tutor used to be handed a prose description of each circuit and retype it in propose_circuit
   * format. The two disagreed on column numbering (1 vs 0), gate naming ("M" vs "MEASURE") and how
   * starting states are written — and each produced a wrong first diagram on the live model.
   */
  it('round-trips every site circuit through the format the model is given, unchanged', () => {
    for (const preset of ALGORITHM_PRESETS) {
      const r = validateProposal(toProposal(preset.circuit))
      expect(r.ok, preset.id).toBe(true)
      // No adjustments at all: nothing moved, renamed, widened or defaulted.
      expect(r.warnings, preset.id).toEqual([])
      expect(r.outcome?.dirac, preset.id).toBe(describeOutcome(preset.circuit).dirac)
    }
  })

  it('writes the three things the model used to get wrong in the form the tool takes', () => {
    const deutsch = toProposal(getPreset('deutsch')!.circuit)
    // The |1⟩ ancilla, as the inputs array — the omission that made Deutsch answer "constant".
    expect(deutsch.inputs).toEqual(['0', '1'])
    // Columns from 0, as the tool counts them.
    expect(Math.min(...deutsch.gates.map((g) => g.column))).toBe(0)
    // The gate id, not its one-letter display label.
    expect(deutsch.gates.some((g) => g.gate === 'MEASURE')).toBe(true)
    expect(deutsch.gates.some((g) => g.gate === 'M')).toBe(false)
  })

  it('puts the site circuit itself on screen, not a rebuild of it', async () => {
    for (const preset of ALGORITHM_PRESETS) {
      const r = await dispatchTool('show_reference_circuit', { name: preset.id })
      expect(r.circuit?.ok, preset.id).toBe(true)
      expect(r.circuit?.circuit, preset.id).toBe(preset.circuit)
      expect(r.circuit?.outcome?.dirac, preset.id).toBe(describeOutcome(preset.circuit).dirac)
    }
  })

  it('tells the model what is on screen and not to build it again', async () => {
    const r = await dispatchTool('show_reference_circuit', { name: "Deutsch's algorithm" })
    expect(r.content).toMatch(/Now on the reader's screen: Deutsch/)
    expect(r.content).toMatch(/Do not build it again/)
    expect(r.content).toContain('/algorithms/')
  })

  it('lists what exists instead of guessing when the name matches nothing', async () => {
    const r = await dispatchTool('show_reference_circuit', { name: 'quantum gastronomy' })
    expect(r.circuit).toBeUndefined()
    expect(r.content).toMatch(/no circuit matching "quantum gastronomy"/)
    for (const preset of ALGORITHM_PRESETS) expect(r.content).toContain(`"${preset.id}"`)
  })

  it('does not treat a word shared across the site as naming a circuit', () => {
    // These used to find the random number generator and the Bell state. A lookup could shrug that
    // off; show_reference_circuit would have put an unrelated circuit on the reader's screen.
    expect(findPreset('quantum gastronomy')).toBeUndefined()
    expect(findPreset('state of the art')).toBeUndefined()
    // Loose phrasing that does name one still lands on it.
    expect(findPreset('deutsch algorithm')?.id).toBe('deutsch')
    expect(findPreset('shor factoring')?.id).toBe('shor')
    expect(findPreset('teleport')?.id).toBe('teleportation')
  })

  it('remembers what it showed, so a rebuild in the same turn is still checked', async () => {
    const turn = newTurn()
    await dispatchTool('show_reference_circuit', { name: 'deutsch' }, { turn })
    const r = await dispatchTool('propose_circuit', { numQubits: 2, gates: deutschGates }, { turn })
    expect(r.content).toMatch(/the site's "deutsch" circuit produces/)
  })
})
