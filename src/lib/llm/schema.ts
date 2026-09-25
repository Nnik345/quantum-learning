/**
 * JSON schema describing a circuit the model may propose.
 *
 * This is handed to Ollama as a tool's parameter schema, which constrains decoding — the model
 * physically cannot emit a differently-shaped object. That reduces the model's job to choosing
 * sensible values, and `validate.ts` still checks those against the real placement rules.
 *
 * The wire format is deliberately simpler than the internal `Circuit`: no placement ids, one
 * `angle` instead of a params array, and inputs as preset names. Fewer degrees of freedom means
 * fewer ways to be wrong.
 */

import { BUILTIN_GATES } from '../quantum/gates'
import { INPUT_PRESETS } from '../quantum/circuit'
import { MAX_QUBITS } from '../quantum/state'

/** Gate ids the model may use. Derived from the real palette so the two cannot drift apart. */
export const ALLOWED_GATES: string[] = BUILTIN_GATES.map((g) => g.id)

/** Input presets the model may use, likewise derived. */
export const ALLOWED_INPUTS: string[] = INPUT_PRESETS.map((p) => p.id)

/** Gates that take an angle, so the prompt and validator agree on which need one. */
export const PARAMETRIC_GATES: string[] = BUILTIN_GATES.filter((g) => g.params?.length).map(
  (g) => g.id,
)

export const CIRCUIT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    numQubits: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_QUBITS,
      description: `Number of wires, 1 to ${MAX_QUBITS}. q0 is the top wire and the LEFTMOST symbol in a ket.`,
    },
    inputs: {
      type: 'array',
      description:
        'Starting state per wire, one entry per qubit in order. Omit for all |0>. Use "1", "+", "-", "i" or "-i" to start elsewhere.',
      items: { type: 'string', enum: ALLOWED_INPUTS },
    },
    gates: {
      type: 'array',
      description: 'Gates in the circuit. Column 0 is applied first.',
      items: {
        type: 'object',
        properties: {
          gate: { type: 'string', enum: ALLOWED_GATES },
          targets: {
            type: 'array',
            description: 'Wires the gate acts on. One entry except SWAP, which takes two.',
            items: { type: 'integer', minimum: 0, maximum: MAX_QUBITS - 1 },
          },
          controls: {
            type: 'array',
            description: 'Control wires. A CNOT is gate "X" with one control.',
            items: { type: 'integer', minimum: 0, maximum: MAX_QUBITS - 1 },
          },
          angle: {
            type: 'number',
            description: `Angle in radians. Required for ${PARAMETRIC_GATES.join(', ')}; ignored otherwise.`,
          },
          column: {
            type: 'integer',
            minimum: 0,
            description: 'Time step. Gates in the same column act simultaneously on disjoint wires.',
          },
        },
        required: ['gate', 'targets', 'column'],
      },
    },
    explanation: {
      type: 'string',
      description: 'One or two sentences on what this circuit does and why it is built this way.',
    },
  },
  required: ['numQubits', 'gates'],
}
