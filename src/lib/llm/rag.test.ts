/**
 * The site as ground truth.
 *
 * Two things are under test here. First, that a verified circuit is reachable by name from anywhere,
 * because the Grover failure was the model building from memory while a tested Grover sat in the
 * codebase. Second, that `compareTo` actually catches that specific failure — the doubled
 * controlled-Z whose oracle cancels itself out.
 */

import { describe, it, expect } from 'vitest'

import { dispatchTool, findPreset, TOOL_DEFINITIONS } from './tools'
import { searchCircuits, presetPage } from './retrieval'
import { buildSystemPrompt, estimateTokens, MAX_SYSTEM_PROMPT_TOKENS } from './systemPrompt'
import { ALGORITHM_PRESETS, getPreset } from '../quantum/presets'

describe('reference circuits are reachable by name', () => {
  it('describes every one of the twelve with gates, outcome and a page link', async () => {
    for (const preset of ALGORITHM_PRESETS) {
      const r = await dispatchTool('get_reference_circuit', { name: preset.id })
      expect(r.content, preset.id).toMatch(/^VERIFIED CIRCUIT/)
      expect(r.content, preset.id).toContain(`"${preset.id}"`)
      expect(r.content, preset.id).toMatch(/\d+ qubits, \d+ gates/)
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

  it('reports a match for the verified Grover', async () => {
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: verifiedGrover,
      compareTo: 'grover',
    })
    expect(r.content).toMatch(/^ACCEPTED/)
    expect(r.content).toMatch(/MATCHES/i)
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
    expect(r.content).toMatch(/DIFFERS/i)
    expect(r.content).toMatch(/get_reference_circuit/)
  })

  it('stays quiet when no reference is named', async () => {
    const r = await dispatchTool('propose_circuit', {
      numQubits: 2,
      gates: [{ gate: 'H', targets: [0], column: 0 }],
    })
    expect(r.content).not.toMatch(/DIFFERS|MATCHES/i)
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

  it('tells the model to consult the reference and to cite pages', () => {
    const prompt = buildSystemPrompt()
    expect(prompt).toMatch(/get_reference_circuit FIRST/)
    expect(prompt).toMatch(/compareTo/)
    expect(prompt).toMatch(/CITE the page/)
    // The catalogue lets it name a circuit without a discovery round-trip.
    for (const preset of ALGORITHM_PRESETS) expect(prompt).toContain(preset.id)
  })
})
