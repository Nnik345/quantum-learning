/**
 * The four tools the model may call, and their dispatch.
 *
 * Every one is read-only or validated. None writes a file, executes code, or makes a network call,
 * so a hostile question cannot do anything worse than produce a silly circuit. The user's free text
 * reaches only these four functions.
 */

import type { Circuit } from '../quantum/circuit'
import { serialiseCircuit } from '../quantum/circuit'
import { gateDef } from '../quantum/circuit'
import { searchContent, topicBySlug, topicToText } from './retrieval'
import { getTopic } from '../../content/registry'
import { pathStepFor } from '../../content/path'
import { getPreset } from '../quantum/presets'
import { validateProposal, summariseForModel, describeOutcome, type ValidationResult } from './validate'
import { CIRCUIT_SCHEMA } from './schema'
import type { ToolDefinition } from './types'

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_content',
      description:
        'Search this site\'s own lessons. Use this before answering anything conceptual so the answer matches what the site teaches. Returns whole topics.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to look for, in plain words.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_page',
      description:
        'Read the lesson page the user is looking at right now, including any worked circuits printed on it. Call this FIRST whenever they say "this", "here", "the circuit above" or ask about the page they are on.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_circuit',
      description:
        'Build a circuit in the simulator. It is validated and run, and the tool returns what it ACTUALLY does — describe that, not what you expected. Use this whenever asked to build, show or demonstrate a circuit.',
      parameters: CIRCUIT_SCHEMA,
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_current_circuit',
      description:
        'Read the circuit the user currently has on their board, with what it does. Call this before commenting on "my circuit" or "this circuit".',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_simulation',
      description:
        'Run a circuit and return exact amplitudes, probabilities and per-qubit Bloch vectors. Give a preset id to run a circuit printed on a lesson page, or omit it to run whatever is on the user\'s board. Use this instead of calculating anything yourself.',
      parameters: {
        type: 'object',
        properties: {
          preset: {
            type: 'string',
            description:
              'Id of a worked circuit from a lesson page, as reported by get_current_page. Omit to use the user\'s own board.',
          },
          shots: {
            type: 'integer',
            description: 'Optionally also sample this many shots to show statistical spread.',
            minimum: 1,
            maximum: 10000,
          },
        },
      },
    },
  },
]

export interface ToolContext {
  /** The circuit on the user's board, if any. */
  currentCircuit?: Circuit
  /** Slug of the page the reader is on, to bias retrieval. */
  currentSlug?: string
}

export interface ToolResult {
  /** Text handed back to the model. */
  content: string
  /** A circuit the UI should render. Never shown unless validation passed. */
  circuit?: ValidationResult
}

/** Human-readable gate list, so the model sees a circuit the way the reader does. */
export function describeCircuit(circuit: Circuit): string {
  const gates = [...circuit.placements]
    .sort((a, b) => a.column - b.column)
    .map((p) => {
      const def = gateDef(circuit, p.gate)
      const controls = p.controls.length ? ` controlled by q${p.controls.join(', q')}` : ''
      const angle = p.params.length ? ` (angle ${(p.params[0] / Math.PI).toFixed(3)}π)` : ''
      return `  column ${p.column + 1}: ${def?.label ?? p.gate} on q${p.targets.join(', q')}${controls}${angle}`
    })

  const inputs = circuit.inputs
    .map((input, q) => (input.preset === '0' ? null : `q${q}=${input.preset}`))
    .filter(Boolean)

  return [
    `${circuit.numQubits} qubits, ${circuit.placements.length} gates.`,
    inputs.length ? `Non-default inputs: ${inputs.join(', ')}` : 'All wires start in |0>.',
    gates.length ? gates.join('\n') : '  (empty)',
  ].join('\n')
}

/** Execute one tool call. Never throws — a failure is returned as text the model can react to. */
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext = {},
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'search_content': {
        const query = typeof args.query === 'string' ? args.query : ''
        if (!query.trim()) return { content: 'No query given.' }

        const hits = searchContent(query, { limit: 2, currentSlug: context.currentSlug })
        if (hits.length === 0) {
          return {
            content:
              'Nothing on the site covers that. Say so, and answer from general knowledge only if you are confident.',
          }
        }
        return {
          content: hits
            .map((h) => `--- from /${h.trackId}/${h.slug} ---\n${h.text}`)
            .join('\n\n'),
        }
      }

      case 'propose_circuit': {
        const result = validateProposal(args)
        return { content: summariseForModel(result), circuit: result }
      }

      case 'get_current_page': {
        if (!context.currentSlug) {
          return {
            content:
              'The user is not on a lesson page right now — they may be on the Circuit Lab or the path overview. Ask what they are looking at, or use search_content.',
          }
        }
        const retrieved = topicBySlug(context.currentSlug)
        if (!retrieved) return { content: `No lesson page matches "${context.currentSlug}".` }

        const topic = getTopic(retrieved.trackId, retrieved.slug)
        const step = pathStepFor(retrieved.slug)

        // Circuits printed on the page. Without these the assistant is blind to the very diagram
        // the reader is pointing at when they say "explain this circuit".
        const presets = (topic?.sections ?? [])
          .flatMap((section) => section.blocks ?? [])
          .filter((block): block is Extract<typeof block, { kind: 'circuit' }> => block.kind === 'circuit')
          .map((block) => getPreset(block.preset))
          .filter((preset): preset is NonNullable<typeof preset> => preset !== undefined)

        const lines = [
          `The user is reading "${retrieved.title}" at /${retrieved.trackId}/${retrieved.slug}.`,
          step ? `That is step ${step.step} of the learning path, in the ${step.stage.title} stage.` : '',
          '',
          topicToText(topic!),
        ]

        if (presets.length > 0) {
          lines.push('', `--- circuits printed on this page (${presets.length}) ---`)
          for (const preset of presets) {
            const outcome = describeOutcome(preset.circuit)
            lines.push(
              '',
              `preset id "${preset.id}" — ${preset.name}`,
              preset.summary,
              describeCircuit(preset.circuit),
              `Result: ${outcome.dirac}`,
              outcome.entangled.length
                ? `Entangled: q${outcome.entangled.join(', q')}`
                : 'No entanglement.',
            )
          }
          lines.push(
            '',
            'Call run_simulation with one of those preset ids for exact numbers. Bitstrings are q0 first (leftmost).',
          )
        } else {
          lines.push('', 'This page prints no circuits.')
        }

        return { content: lines.filter((l) => l !== '').join('\n') }
      }

      case 'get_current_circuit': {
        if (!context.currentCircuit || context.currentCircuit.placements.length === 0) {
          return { content: 'The board is empty — the user has not placed any gates yet.' }
        }
        const outcome = describeOutcome(context.currentCircuit)
        return {
          content: [
            describeCircuit(context.currentCircuit),
            '',
            `Final state: ${outcome.dirac}`,
            outcome.entangled.length
              ? `Entangled qubits: q${outcome.entangled.join(', q')}`
              : 'No entanglement.',
            'Bitstrings are written q0 first (leftmost).',
          ].join('\n'),
        }
      }

      case 'run_simulation': {
        // A named preset means a circuit printed on a lesson page; otherwise the user's own board.
        const presetId = typeof args.preset === 'string' ? args.preset.trim() : ''
        let circuit: Circuit | undefined = context.currentCircuit
        let label = 'the board'

        if (presetId) {
          const preset = getPreset(presetId)
          if (!preset) {
            return {
              content: `There is no circuit preset called "${presetId}". Call get_current_page to see which are on this page.`,
            }
          }
          circuit = preset.circuit
          label = `"${preset.name}"`
        }

        if (!circuit || circuit.placements.length === 0) {
          return {
            content: presetId
              ? `${label} has no gates.`
              : 'There is no circuit on the board to run. If you meant a circuit printed on the page, pass its preset id.',
          }
        }
        const outcome = describeOutcome(circuit)
        const lines = [
          `Simulated ${label}.`,
          `State: ${outcome.dirac}`,
          `Probabilities: ${outcome.probabilities
            .map((p) => `${p.label} ${p.percent.toFixed(2)}%`)
            .join(', ')}`,
          `Bloch vectors: ${outcome.bloch
            .map(
              (b) =>
                `q${b.qubit} (${b.x.toFixed(3)}, ${b.y.toFixed(3)}, ${b.z.toFixed(3)}) |r|=${b.length.toFixed(3)}`,
            )
            .join('; ')}`,
        ]

        const shots = typeof args.shots === 'number' ? Math.round(args.shots) : undefined
        if (shots && shots > 0) {
          const { runShots } = await import('../quantum/simulate')
          const { counts } = runShots(circuit, Math.min(shots, 10000), 1)
          lines.push(
            `Sampled ${shots} shots: ${Object.entries(counts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => `${k} x${v}`)
              .join(', ')}`,
          )
        }
        return { content: lines.join('\n') }
      }

      default:
        return { content: `There is no tool called "${name}".` }
    }
  } catch (err) {
    return {
      content: `That tool failed: ${err instanceof Error ? err.message : String(err)}. Try a different approach.`,
    }
  }
}

/** Serialise a circuit for handing to the UI. */
export const circuitToPayload = (circuit: Circuit) => serialiseCircuit(circuit)

export { topicBySlug }
