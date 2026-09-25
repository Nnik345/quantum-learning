/**
 * The four tools the model may call, and their dispatch.
 *
 * Every one is read-only or validated. None writes a file, executes code, or makes a network call,
 * so a hostile question cannot do anything worse than produce a silly circuit. The user's free text
 * reaches only these four functions.
 */

import type { Circuit } from '../quantum/circuit'
import { getCurrentPython } from '../python/pythonBridge'
import { serialiseCircuit } from '../quantum/circuit'
import { gateDef } from '../quantum/circuit'
import {
  searchContent,
  searchCircuits,
  topicBySlug,
  topicToText,
  presetPage,
  findTopic,
  topicDirectory,
} from './retrieval'
import { ALGORITHM_PRESETS } from '../quantum/presets'
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
      name: 'get_reference_circuit',
      description:
        'Look up a VERIFIED circuit for a known algorithm — its exact gates, what it really produces, and the page it appears on. Call this BEFORE building any named algorithm, so you are working from ground truth rather than memory. Call it with no name to list every circuit available.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Algorithm name or preset id, e.g. "grover", "teleportation", "Bell state". Omit to list all.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_topic',
      description:
        'Open a specific lesson page by name and read all of it. Use this when you know which page you want; use search_content when you do not.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Topic title or slug, e.g. "Grover\'s Search" or "entanglement".' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_circuit',
      description:
        'Build a circuit in the simulator. It is validated and run, and the tool returns what it ACTUALLY does — describe that, not what you expected. Use this whenever asked to build, show or demonstrate a circuit. When building a known algorithm, pass compareTo with its name to have your circuit checked against the verified one.',
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
      name: 'get_python_code',
      description:
        "Read the Python the user has in the editor, what it printed, any traceback, and the task they are attempting. Call this FIRST whenever they mention their code, an error, or ask why something does not work.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_python',
      description:
        "Offer Python the user can put into their editor with one click. Use it to show a fix or a worked approach. Send the COMPLETE program, not a fragment, since it replaces what is there. Explain the change in your reply; do not rely on comments alone.",
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The complete Python program.' },
          explanation: {
            type: 'string',
            description: 'One line on what changed and why, shown above the code.',
          },
        },
        required: ['code'],
      },
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
  /** Python the UI should offer to put in the editor. */
  python?: { code: string; explanation?: string }
}

/**
 * Find a verified circuit by id or name, tolerantly.
 *
 * The model says "grover", "Grover's Search", "grovers search" — all should land on the same
 * preset, since the whole point is that looking up ground truth must not fail on phrasing.
 */
export function findPreset(query: string) {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const wanted = norm(query)
  if (!wanted) return undefined

  const candidates = ALGORITHM_PRESETS.map((preset) => ({
    preset,
    id: norm(preset.id),
    name: norm(preset.name),
  }))

  return (
    candidates.find((c) => c.id === wanted || c.name === wanted)?.preset ??
    candidates.find((c) => c.id.includes(wanted) || c.name.includes(wanted))?.preset ??
    // Last resort: any query word that is distinctive enough to name a preset.
    candidates.find((c) =>
      wanted.split(' ').some((w) => w.length >= 4 && (c.id.includes(w) || c.name.includes(w))),
    )?.preset
  )
}

/** One verified circuit, rendered for the model: gates, real outcome, and where it is printed. */
function describeReference(preset: (typeof ALGORITHM_PRESETS)[number]): string {
  const outcome = describeOutcome(preset.circuit)
  const page = presetPage(preset.id)
  return [
    `VERIFIED CIRCUIT "${preset.id}" — ${preset.name}`,
    preset.summary,
    describeCircuit(preset.circuit),
    `Produces: ${outcome.dirac}`,
    `Outcomes: ${outcome.probabilities.slice(0, 6).map((x) => `${x.label} ${x.percent.toFixed(1)}%`).join(', ')}`,
    outcome.entangled.length ? `Entangled: q${outcome.entangled.join(', q')}` : 'No entanglement.',
    page ? `Explained on /${page.trackId}/${page.slug} ("${page.title}")` : '',
    'This circuit is tested and known correct. Build from it rather than from memory.',
  ]
    .filter(Boolean)
    .join('\n')
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
        const circuits = searchCircuits(query, 2)
        const parts = hits.map((h) => `--- from /${h.trackId}/${h.slug} ---\n${h.text}`)

        // Circuits come after the prose and are capped, so they can never crowd lesson text out.
        for (const hit of circuits) {
          parts.push(
            `--- verified circuit, ${hit.page ? `printed on /${hit.page.trackId}/${hit.page.slug}` : 'not printed on a page'} ---\n` +
              describeReference(hit.preset),
          )
        }
        return { content: parts.join('\n\n') }
      }

      case 'propose_circuit': {
        const result = validateProposal(args)
        let content = summariseForModel(result)

        // An explicit self-check against ground truth. The model names what it is implementing,
        // so nothing has to be inferred — a guessed comparison would contradict the reader
        // whenever the guess was wrong.
        const compareTo = typeof args.compareTo === 'string' ? args.compareTo.trim() : ''
        if (compareTo && result.ok && result.outcome) {
          const reference = findPreset(compareTo)
          if (!reference) {
            content += `\n\nNo verified circuit named "${compareTo}" — call get_reference_circuit with no name to see what exists.`
          } else {
            const theirs = describeOutcome(reference.circuit)
            const same = theirs.dirac === result.outcome.dirac
            content += same
              ? `\n\nMatches the verified "${reference.id}" circuit, which also produces ${theirs.dirac}.`
              : `\n\nDIFFERS from the verified "${reference.id}" circuit, which produces ${theirs.dirac} ` +
                `(${theirs.probabilities.slice(0, 4).map((x) => `${x.label} ${x.percent.toFixed(1)}%`).join(', ')}). ` +
                `Yours produces ${result.outcome.dirac}. Call get_reference_circuit to see its gates, then fix yours.`
          }
        }
        return { content, circuit: result }
      }

      case 'get_reference_circuit': {
        const name = typeof args.name === 'string' ? args.name.trim() : ''
        const preset = name ? findPreset(name) : undefined

        if (!preset) {
          // Blind or unmatched calls list everything, so the model can discover what exists
          // instead of needing to already know the ids.
          const catalogue = ALGORITHM_PRESETS.map((p) => {
            const page = presetPage(p.id)
            return `  "${p.id}" — ${p.name}${page ? ` (/${page.trackId}/${page.slug})` : ''}`
          }).join('\n')
          return {
            content:
              (name ? `No verified circuit matches "${name}".\n\n` : '') +
              `Verified circuits available:\n${catalogue}\n\nCall this tool again with one of those names.`,
          }
        }
        return { content: describeReference(preset) }
      }

      case 'open_topic': {
        const name = typeof args.name === 'string' ? args.name.trim() : ''
        if (!name) return { content: 'Give the name of the page to open.' }

        const found = findTopic(name)
        if (!found) {
          // Naming the real pages beats sending it back to guess, and beats answering from a page
          // that merely shares a word with what it asked for.
          return {
            content: [
              `No page is called "${name}". The pages are:`,
              topicDirectory(),
              'Open one of these by name, or use search_content to search by keyword.',
            ].join('\n'),
          }
        }

        const step = pathStepFor(found.slug)
        return {
          content: [
            `/${found.trackId}/${found.slug} — "${found.title}"`,
            step ? `Step ${step.step} of the learning path, in the ${step.stage.title} stage.` : '',
            '',
            found.text,
          ]
            .filter((l) => l !== '')
            .join('\n'),
        }
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

      case 'get_python_code': {
        const snapshot = getCurrentPython()
        if (!snapshot) {
          return {
            content:
              'The user is not on a Python page right now, so there is no editor to read. The Python guide is at /python and the open editor at /python/playground.',
          }
        }

        const lines = [
          snapshot.where === 'lesson'
            ? `They are on Python lesson "${snapshot.lessonTitle}" (/python/${snapshot.lessonSlug}).`
            : 'They are in the Python playground (/python/playground).',
          snapshot.taskPrompt ? `The task: ${snapshot.taskPrompt}` : '',
          snapshot.taskTarget ? `Success looks like: ${snapshot.taskTarget}` : '',
          '',
          '--- their code ---',
          snapshot.code.trim() || '(the editor is empty)',
        ]

        if (snapshot.error) lines.push('', '--- it raised ---', snapshot.error)
        if (snapshot.stdout?.trim()) lines.push('', '--- it printed ---', snapshot.stdout.trim())
        if (snapshot.stderr?.trim()) lines.push('', '--- stderr ---', snapshot.stderr.trim())
        if (snapshot.verdict) lines.push('', `--- the grader said ---`, snapshot.verdict)
        if (!snapshot.error && !snapshot.stdout?.trim() && !snapshot.verdict) {
          lines.push('', 'They have not run it yet.')
        }

        /*
         * Deliberately no solution. Helping someone reason to an answer is the job; handing it over
         * is not, and the surest way to keep that true is for the answer never to arrive here.
         */
        lines.push(
          '',
          'You do NOT have the task\'s solution. Help them reason it out; do not claim to know the expected answer.',
        )
        return { content: lines.filter((l) => l !== '').join('\n') }
      }

      case 'suggest_python': {
        const code = typeof args.code === 'string' ? args.code : ''
        if (!code.trim()) return { content: 'No code given.' }

        const explanation = typeof args.explanation === 'string' ? args.explanation : undefined
        return {
          content:
            'Shown to the user with a button to put it in their editor. Now explain in your reply what you changed and why — they can read the code themselves.',
          python: { code, explanation },
        }
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
