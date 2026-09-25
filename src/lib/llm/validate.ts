/**
 * Turn a model's proposed circuit into a real, legal one — or say exactly why it cannot.
 *
 * Model output is untrusted input, the same category as a hand-edited circuit file, so it goes
 * through the same machinery: `checkPlacement` for the placement rules, `MAX_QUBITS` for the
 * register, `simulate` for what it actually does. Nothing here trusts the model's description of
 * its own circuit; the returned outcome is always computed.
 *
 * The one forgiving step is column bumping. Models routinely put two gates on the same wire in the
 * same column when they mean "one after the other", so a colliding gate is pushed to the next free
 * column rather than dropped. That preserves the intended order — the bumped gate still comes after
 * whatever it collided with — and is reported as a warning.
 */

import {
  MAX_COLUMNS,
  MIN_COLUMNS,
  checkPlacement,
  createCircuit,
  gateDef,
  type Circuit,
  type Placement,
  type QubitInput,
} from '../quantum/circuit'
import { MAX_QUBITS } from '../quantum/state'
import { simulate } from '../quantum/simulate'
import { basisLabel, blochVector, probabilities, significantAmplitudes } from '../quantum/state'
import { format } from '../quantum/complex'
import { BUILTIN_BY_ID } from '../quantum/gates'
import { ALLOWED_GATES, ALLOWED_INPUTS, PARAMETRIC_GATES } from './schema'
import type { ProposedCircuit, ProposedGate } from './types'

export interface CircuitOutcome {
  /** The state written the way the site writes it, e.g. "0.707|00⟩ + 0.707|11⟩". */
  dirac: string
  probabilities: { label: string; percent: number }[]
  bloch: { qubit: number; x: number; y: number; z: number; length: number }[]
  /** Qubits whose Bloch vector is shorter than 1 — entangled with something. */
  entangled: number[]
}

export interface ValidationResult {
  ok: boolean
  circuit?: Circuit
  outcome?: CircuitOutcome
  /** Things changed to make it legal. The model is told about these so it can do better next time. */
  warnings: string[]
  /** Reasons a gate or the whole circuit was rejected. */
  errors: string[]
  explanation?: string
}

/**
 * Canonical forms for gate names every model reaches for but this palette does not have.
 *
 * CNOT, CZ and Toffoli are near-universal names; the simulator spells them as X, Z and X with
 * control wires. Rejecting the familiar name teaches the model nothing and wastes a whole retry
 * round, so the alias is expanded instead. The expansion is deterministic and the result still
 * goes through checkPlacement like anything else.
 *
 * Each entry says which real gate to use and how many of the given wires are controls, counted
 * from the front.
 */
const GATE_ALIASES: Record<string, { gate: string; controls: number }> = {
  CNOT: { gate: 'X', controls: 1 },
  CX: { gate: 'X', controls: 1 },
  NOT: { gate: 'X', controls: 0 },
  CZ: { gate: 'Z', controls: 1 },
  CY: { gate: 'Y', controls: 1 },
  CCX: { gate: 'X', controls: 2 },
  TOFFOLI: { gate: 'X', controls: 2 },
  CCZ: { gate: 'Z', controls: 2 },
  CSWAP: { gate: 'SWAP', controls: 1 },
  FREDKIN: { gate: 'SWAP', controls: 1 },
  CP: { gate: 'P', controls: 1 },
  CPHASE: { gate: 'P', controls: 1 },
  CRZ: { gate: 'RZ', controls: 1 },
  M: { gate: 'MEASURE', controls: 0 },
  MEASURE_ALL: { gate: 'MEASURE', controls: 0 },
}

const asInt = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined

const asIntArray = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(asInt).filter((n): n is number => n !== undefined) : []

/** Coerce one entry of the model's `gates` array, or explain why it is unusable. */
function readGate(
  raw: unknown,
  index: number,
): { gate?: ProposedGate; error?: string; note?: string } {
  if (typeof raw !== 'object' || raw === null) return { error: `gate ${index}: not an object` }
  const g = raw as Record<string, unknown>

  const raw_name = typeof g.gate === 'string' ? g.gate : undefined
  if (!raw_name) return { error: `gate ${index}: missing "gate"` }

  let name = raw_name
  let targets = asIntArray(g.targets)
  let controls = asIntArray(g.controls)
  let note: string | undefined

  // Expand a familiar alias into this palette's spelling, taking its leading wires as controls.
  const alias = GATE_ALIASES[raw_name.toUpperCase()]
  if (alias && !ALLOWED_GATES.includes(raw_name)) {
    if (targets.length > alias.controls) {
      controls = [...controls, ...targets.slice(0, alias.controls)]
      targets = targets.slice(alias.controls)
    } else if (targets.length === 0 && controls.length > alias.controls) {
      /*
       * A symmetric gate written as controls only. CZ is drawn as two identical dots with no
       * target box, so listing both wires as controls is faithful to the notation even though
       * this simulator needs one of them named as the target. Take the last.
       */
      const arity = BUILTIN_BY_ID[alias.gate]?.arity ?? 1
      targets = controls.slice(-arity)
      controls = controls.slice(0, -arity)
    }
    name = alias.gate
    note = `Read "${raw_name}" as ${alias.gate}${alias.controls ? ` with ${alias.controls} control wire(s)` : ''}`
  }

  if (!ALLOWED_GATES.includes(name)) {
    return { error: `gate ${index}: "${raw_name}" is not a gate on this platform` }
  }
  if (targets.length === 0) return { error: `gate ${index} (${raw_name}): no target wires` }

  const column = asInt(g.column)
  if (column === undefined || column < 0) {
    return { error: `gate ${index} (${name}): missing or negative column` }
  }

  const angle = typeof g.angle === 'number' && Number.isFinite(g.angle) ? g.angle : undefined
  return { gate: { gate: name, targets, controls, angle, column }, note }
}

/** Inputs for each wire, falling back to |0⟩ for anything missing or unrecognised. */
function readInputs(raw: unknown, numQubits: number, warnings: string[]): QubitInput[] {
  const list = Array.isArray(raw) ? raw : []
  return Array.from({ length: numQubits }, (_, q) => {
    const value = list[q]
    if (value === undefined) return { preset: '0' as const }
    const name = String(value)
    if (!ALLOWED_INPUTS.includes(name)) {
      warnings.push(`q${q}: input "${name}" is not a preset here, used |0⟩ instead`)
      return { preset: '0' as const }
    }
    return { preset: name as QubitInput['preset'] }
  })
}

/** What the circuit actually does, computed rather than taken from the model's description. */
export function describeOutcome(circuit: Circuit): CircuitOutcome {
  const { states } = simulate(circuit)
  const final = states[states.length - 1]

  const dirac =
    significantAmplitudes(final, 1e-6)
      .slice(0, 6)
      .map(({ amp, label }) => `${format(amp, 3)}|${label}⟩`)
      .join(' + ') || '0'

  const probs = probabilities(final)
  const probabilityList: { label: string; percent: number }[] = []
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > 1e-6) {
      probabilityList.push({ label: basisLabel(i, final.n), percent: probs[i] * 100 })
    }
  }
  probabilityList.sort((a, b) => b.percent - a.percent)

  const bloch = Array.from({ length: final.n }, (_, q) => {
    const b = blochVector(final, q)
    return { qubit: q, x: b.x, y: b.y, z: b.z, length: b.length }
  })

  return {
    dirac,
    probabilities: probabilityList,
    bloch,
    entangled: bloch.filter((b) => b.length < 0.999).map((b) => b.qubit),
  }
}

/**
 * Validate a proposed circuit. Never throws — hostile or malformed input comes back as
 * `ok: false` with reasons the model can act on.
 */
export function validateProposal(raw: unknown): ValidationResult {
  const warnings: string[] = []
  const errors: string[] = []

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, warnings, errors: ['The circuit was not an object'] }
  }
  const proposal = raw as Partial<ProposedCircuit>

  // --- register size -------------------------------------------------------
  const requested = asInt(proposal.numQubits) ?? 0
  if (requested < 1) {
    return { ok: false, warnings, errors: ['numQubits must be at least 1'] }
  }
  let numQubits = Math.min(MAX_QUBITS, requested)
  if (requested > MAX_QUBITS) {
    warnings.push(
      `Asked for ${requested} qubits; this simulator supports at most ${MAX_QUBITS}, so it was reduced to ${MAX_QUBITS}.`,
    )
  }

  // --- gates ---------------------------------------------------------------
  const rawGates = Array.isArray(proposal.gates) ? proposal.gates : []
  if (rawGates.length === 0) errors.push('The circuit contained no gates')

  const parsed: ProposedGate[] = []
  rawGates.forEach((raw, i) => {
    const { gate, error, note } = readGate(raw, i)
    if (error) {
      errors.push(error)
      return
    }
    if (!gate) return
    if (note) warnings.push(note)

    /*
     * "H on wires [0, 1]" is how a model naturally says "Hadamard both", but a one-qubit gate takes
     * one target. Split it into one gate per wire in the same column — which is exactly what was
     * meant, and unambiguous, since they act simultaneously on disjoint wires.
     */
    const def = BUILTIN_BY_ID[gate.gate]
    if (def && def.arity === 1 && gate.targets.length > 1 && (gate.controls?.length ?? 0) === 0) {
      warnings.push(
        `Applied ${def.label} to each of q${gate.targets.join(', q')} separately, as one gate per wire`,
      )
      for (const target of gate.targets) parsed.push({ ...gate, targets: [target] })
      return
    }
    parsed.push(gate)
  })

  // Widen the register if a gate reaches past it — a reach beyond MAX_QUBITS is a real error.
  const highestWire = parsed.reduce(
    (max, g) => Math.max(max, ...g.targets, ...(g.controls ?? [])),
    -1,
  )
  if (highestWire >= MAX_QUBITS) {
    errors.push(`A gate targets q${highestWire}, past the ${MAX_QUBITS}-qubit limit`)
  } else if (highestWire >= numQubits) {
    numQubits = highestWire + 1
    warnings.push(`Widened the register to ${numQubits} qubits to fit every gate`)
  }

  const inputs = readInputs(proposal.inputs, numQubits, warnings)
  let circuit: Circuit = {
    ...createCircuit(numQubits, MIN_COLUMNS),
    inputs,
    columns: MAX_COLUMNS,
    placements: [],
  }

  // --- place them one at a time, checking each against the rest ------------
  parsed
    .slice()
    .sort((a, b) => a.column - b.column)
    .forEach((g, i) => {
      const def = gateDef(circuit, g.gate)
      if (!def) {
        errors.push(`gate ${i}: "${g.gate}" is unknown`)
        return
      }
      if (g.targets.length !== def.arity) {
        errors.push(
          `${def.name} needs exactly ${def.arity} target wire(s), got ${g.targets.length}`,
        )
        return
      }

      const needsAngle = PARAMETRIC_GATES.includes(g.gate)
      if (needsAngle && g.angle === undefined) {
        warnings.push(`${def.name} had no angle, used its default`)
      }
      const params = needsAngle
        ? [g.angle ?? def.params?.[0]?.default ?? 0]
        : []

      // Try the requested column, then later ones. Later preserves the intended order.
      let placed = false
      let lastReason = ''
      for (let column = g.column; column < MAX_COLUMNS; column++) {
        const placement: Placement = {
          id: `llm${i}`,
          gate: g.gate,
          targets: g.targets,
          controls: g.controls ?? [],
          params,
          column,
        }
        const check = checkPlacement(circuit, placement)
        if (check.ok) {
          if (column !== g.column) {
            warnings.push(
              `Moved ${def.label} from column ${g.column + 1} to ${column + 1} — the wires were busy`,
            )
          }
          circuit = { ...circuit, placements: [...circuit.placements, placement] }
          placed = true
          break
        }
        lastReason = check.reason ?? 'rejected'
        // Only a collision is worth retrying; anything else fails the same way in every column.
        if (!/occupies|cross/i.test(lastReason)) break
      }
      if (!placed) errors.push(`${def.label} at column ${g.column + 1}: ${lastReason}`)
    })

  if (circuit.placements.length === 0) {
    return { ok: false, warnings, errors: errors.length ? errors : ['Nothing could be placed'] }
  }

  // Trim to the columns actually used, leaving a little room to edit.
  const lastColumn = circuit.placements.reduce((m, p) => Math.max(m, p.column), 0)
  circuit = { ...circuit, columns: Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, lastColumn + 2)) }

  const { errors: simErrors } = simulate(circuit)
  errors.push(...simErrors)

  return {
    ok: errors.length === 0,
    circuit,
    outcome: describeOutcome(circuit),
    warnings,
    errors,
    explanation: typeof proposal.explanation === 'string' ? proposal.explanation : undefined,
  }
}

/** Compact, token-cheap summary of a validated circuit to hand back to the model. */
export function summariseForModel(result: ValidationResult): string {
  if (!result.ok || !result.circuit || !result.outcome) {
    return `REJECTED. ${result.errors.join('; ')}${
      result.warnings.length ? ` (also: ${result.warnings.join('; ')})` : ''
    }\nFix these and call the tool again.`
  }

  const { outcome, circuit } = result
  const lines = [
    `ACCEPTED: ${circuit.numQubits} qubits, ${circuit.placements.length} gates.`,
    `Final state: ${outcome.dirac}`,
    `Outcomes: ${outcome.probabilities
      .slice(0, 8)
      .map((p) => `${p.label} ${p.percent.toFixed(1)}%`)
      .join(', ')}`,
  ]
  if (outcome.entangled.length > 0) {
    lines.push(`Entangled qubits (Bloch vector shortened): q${outcome.entangled.join(', q')}`)
  } else {
    lines.push('No entanglement — every qubit is in a pure state of its own.')
  }
  if (result.warnings.length > 0) lines.push(`Adjustments made: ${result.warnings.join('; ')}`)
  lines.push(
    'Bitstrings above are written q0 first (leftmost). Describe the result using exactly these labels.',
    // Deliberately no "call the tool again" nudge here. It was tried, and with reasoning off it
    // correlated with a drop from 11/12 to 10/12 — the extra instruction in every tool result
    // seems to cost more than the occasional retry it buys. The same advice lives in the system
    // prompt, where it is stated once instead of after every circuit.
  )
  return lines.join('\n')
}
