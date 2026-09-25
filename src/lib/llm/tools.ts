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
import { searchContent, topicBySlug } from './retrieval'
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
        'Run the user\'s current circuit and return exact amplitudes, probabilities and per-qubit Bloch vectors. Use this instead of calculating anything yourself.',
      parameters: {
        type: 'object',
        properties: {
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

/** Human-readable gate list, so the model sees the board the way the user does. */
function describeCircuit(circuit: Circuit): string {
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
        if (!context.currentCircuit || context.currentCircuit.placements.length === 0) {
          return { content: 'There is no circuit on the board to run.' }
        }
        const outcome = describeOutcome(context.currentCircuit)
        const lines = [
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
          const { counts } = runShots(context.currentCircuit, Math.min(shots, 10000), 1)
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
