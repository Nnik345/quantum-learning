/**
 * Turning an attempt into a verdict.
 *
 * The rule throughout: grade what the circuit DOES. Placements are never compared, so a learner who
 * arrives at the right answer with the gates in different columns, by a different decomposition, or
 * with a measurement left on a wire is marked correct — because they are.
 *
 * Feedback describes the learner's own outcome against the target in words, never the solution's
 * gates. Telling someone the answer is not marking their work.
 */

import {
  equalUpToGlobalPhase,
  finalState,
  implementsSameOperation,
} from '../lib/quantum/equivalence'
import { basisLabel, marginalProbability, probabilities } from '../lib/quantum/state'
import { simulate } from '../lib/quantum/simulate'
import type { Circuit } from '../lib/quantum/circuit'
import { predictCircuit, type BuildExercise, type Exercise, type PredictExercise, type ValueExercise } from './exercises'

export interface Verdict {
  correct: boolean
  /** One line the learner reads. Always says something specific about their own attempt. */
  message: string
}

/** Up to six outcomes of a state, as "01 50.0%", for describing what a circuit actually did. */
function outcomeSummary(circuit: Circuit): string {
  const probs = probabilities(finalState(circuit))
  const n = circuit.numQubits
  const rows: { label: string; percent: number }[] = []
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > 1e-6) rows.push({ label: basisLabel(i, n), percent: probs[i] * 100 })
  }
  rows.sort((a, b) => b.percent - a.percent)
  return rows
    .slice(0, 6)
    .map((r) => `|${r.label}⟩ ${r.percent.toFixed(1)}%`)
    .join(', ')
}

function gradeBuild(exercise: BuildExercise, attempt: Circuit): Verdict {
  if (attempt.placements.length === 0) {
    return { correct: false, message: 'The board is empty — place some gates and check again.' }
  }

  // Different registers cannot be compared at all, so say that rather than reporting a mismatch.
  if (attempt.numQubits !== exercise.solution.numQubits) {
    return {
      correct: false,
      message: `This exercise is on ${exercise.solution.numQubits} ${
        exercise.solution.numQubits === 1 ? 'wire' : 'wires'
      }, and your circuit has ${attempt.numQubits}. Change the wire count and try again.`,
    }
  }

  const { errors } = simulate(attempt)
  if (errors.length > 0) {
    return { correct: false, message: `That circuit does not run: ${errors[0]}` }
  }

  const correct =
    exercise.grade === 'operation'
      ? implementsSameOperation(attempt, exercise.solution)
      : equalUpToGlobalPhase(finalState(attempt), finalState(exercise.solution))

  if (correct) {
    return {
      correct: true,
      message:
        exercise.grade === 'operation'
          ? 'Correct — it behaves the right way on every input, not just this one.'
          : 'Correct — that is the target state.',
    }
  }

  if (exercise.grade === 'operation') {
    return {
      correct: false,
      message: `Not yet. From |${'0'.repeat(attempt.numQubits)}⟩ yours gives ${outcomeSummary(
        attempt,
      )}, but the test is every input, not only this one. Target: ${exercise.target}.`,
    }
  }

  return {
    correct: false,
    message: `Not yet. Yours gives ${outcomeSummary(attempt)}. Target: ${exercise.target}.`,
  }
}

function gradePredict(exercise: PredictExercise, answer: number): Verdict {
  const actual =
    marginalProbability(finalState(predictCircuit(exercise)), exercise.wires, exercise.bits) * 100
  if (Math.abs(answer - actual) <= exercise.tolerance) {
    return { correct: true, message: `Correct — ${actual.toFixed(1)}%.` }
  }
  return {
    correct: false,
    message: `Not quite. You said ${answer}%; run the circuit and add up every outcome whose wires ${exercise.wires
      .map((w) => `q${w}`)
      .join(', ')} read ${exercise.bits}.`,
  }
}

function gradeValue(exercise: ValueExercise, answer: number): Verdict {
  if (Math.abs(answer - exercise.expected) <= exercise.tolerance) {
    return { correct: true, message: `Correct — ${exercise.expected}${exercise.unit}.` }
  }
  return { correct: false, message: `Not quite. ${exercise.hint ?? 'Try again.'}` }
}

/** Grade a numeric answer. Build exercises are graded from the board instead. */
export function gradeAnswer(exercise: Exercise, answer: number): Verdict {
  if (exercise.kind === 'predict') return gradePredict(exercise, answer)
  if (exercise.kind === 'value') return gradeValue(exercise, answer)
  return { correct: false, message: 'This exercise is graded from the circuit board.' }
}

/** Grade a circuit built on the board. */
export function gradeCircuit(exercise: Exercise, attempt: Circuit): Verdict {
  if (exercise.kind !== 'build') {
    return { correct: false, message: 'This exercise is answered with a number, not a circuit.' }
  }
  return gradeBuild(exercise, attempt)
}
