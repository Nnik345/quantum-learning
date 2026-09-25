/**
 * A short Qiskit course, written to be typed rather than read.
 *
 * Each lesson explains one idea, then hands over a stub with the interesting line missing. What the
 * learner writes is graded the same way the circuit exercises are — by RUNNING it and comparing
 * behaviour — so any correct Qiskit passes, whatever shape they wrote it in. Nothing compares source
 * text, because there is no single right way to write a Bell state.
 *
 * Lessons mirror the site's own path, and each links back to the quantum lesson it belongs to, so
 * the code and the theory are never separated.
 */

import { type Circuit } from '../lib/quantum/circuit'
import { build, g, spread } from '../lib/quantum/builder'
import type { GradingMode } from './exercises'

export interface PythonLesson {
  slug: string
  title: string
  blurb: string
  /** Prose and code samples, in order. */
  body: LessonBlock[]
  task: LessonTask
  /** The site lesson this belongs beside. */
  lesson?: string
}

export type LessonBlock =
  | { kind: 'text'; text: string }
  | { kind: 'code'; code: string; caption?: string }
  | { kind: 'note'; text: string }

export interface LessonTask {
  prompt: string
  /** What the learner starts from. Never the answer. */
  starter: string
  hint: string
  /** The behaviour their code must reproduce. Never shown. */
  solution: Circuit
  grade: GradingMode
  /** Success described in words, for the failure message. */
  target: string
}

// ---------------------------------------------------------------------------
// Reference circuits, in THIS site's wire order (q0 is the top wire).
// The learner writes Qiskit; their circuit is flipped before it reaches these.
// ---------------------------------------------------------------------------

const oneX = build(1, 4, [g('X', [0], 0)])
const onePlus = build(1, 4, [g('H', [0], 0)])
const measuredPlus = build(1, 4, [g('H', [0], 0), g('MEASURE', [0], 1)])
const bell = build(2, 4, [g('H', [0], 0), g('X', [1], 1, [0])])
const ghz = build(3, 5, [g('H', [0], 0), g('X', [1], 1, [0]), g('X', [2], 2, [1])])
const grover = build(2, 8, [
  ...spread('H', [0, 1], 0),
  g('Z', [1], 1, [0]),
  ...spread('H', [0, 1], 2),
  ...spread('X', [0, 1], 3),
  g('Z', [1], 4, [0]),
  ...spread('X', [0, 1], 5),
  ...spread('H', [0, 1], 6),
])

export const PYTHON_LESSONS: PythonLesson[] = [
  {
    slug: 'first-circuit',
    title: 'Your first circuit',
    blurb: 'A register, a gate, and a way to see what happened.',
    lesson: '/theory/dirac-notation',
    body: [
      {
        kind: 'text',
        text: 'A Qiskit program is three things: make a circuit, put gates on it, look at the result. Everything else is detail.',
      },
      {
        kind: 'code',
        code: `from qiskit import QuantumCircuit

circuit = QuantumCircuit(1)   # one qubit, starting in |0>`,
        caption: 'QuantumCircuit(n) gives you n wires, all in |0⟩.',
      },
      {
        kind: 'text',
        text: 'Gates are methods on the circuit. `circuit.x(0)` applies an X gate to qubit 0 — a bit flip, taking |0⟩ to |1⟩.',
      },
      {
        kind: 'text',
        text: 'To see the result without measuring, ask for the state vector. `Statevector.from_instruction` runs the circuit exactly, with no sampling.',
      },
      {
        kind: 'code',
        code: `from qiskit.quantum_info import Statevector

state = Statevector.from_instruction(circuit)
print(state.probabilities_dict())`,
      },
      {
        kind: 'note',
        text: 'Name your circuit `circuit`. That is the variable this page looks for when it offers to put your work on the board.',
      },
    ],
    task: {
      prompt: 'Flip the single qubit from |0⟩ to |1⟩, so the state is |1⟩ with certainty.',
      starter: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(1)

# Your line here: apply a bit flip to qubit 0


print(Statevector.from_instruction(circuit).probabilities_dict())`,
      hint: 'The bit-flip gate is X, and gates are methods: circuit.x(0).',
      solution: oneX,
      grade: 'state',
      target: '|1⟩ with certainty',
    },
  },

  {
    slug: 'superposition',
    title: 'Superposition',
    blurb: 'The Hadamard gate, and why it is the start of almost every algorithm.',
    lesson: '/theory/quantum-gates',
    body: [
      {
        kind: 'text',
        text: 'The Hadamard gate takes a definite state and splits it evenly. From |0⟩ it produces |+⟩ — equal amplitude on |0⟩ and |1⟩, so measuring gives each half the time.',
      },
      { kind: 'code', code: `circuit.h(0)` },
      {
        kind: 'text',
        text: 'Almost every algorithm on this site opens with a layer of Hadamards, because interference needs something to interfere. A definite state has nothing to cancel against.',
      },
      {
        kind: 'text',
        text: 'You can apply one gate to several wires at once by passing a list: `circuit.h([0, 1, 2])`.',
      },
      {
        kind: 'note',
        text: 'H is its own inverse. Applying it twice returns you exactly where you started, which is why the oracle algorithms sandwich their query between two layers of it.',
      },
    ],
    task: {
      prompt: 'Put a single qubit into an even superposition, so both outcomes are 50%.',
      starter: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(1)

# Your line here


print(Statevector.from_instruction(circuit).probabilities_dict())`,
      hint: 'One Hadamard on qubit 0.',
      solution: onePlus,
      // The prompt asks for outcome probabilities, so |−⟩ is as correct as |+⟩.
      grade: 'distribution',
      target: 'an even superposition — 50% on each outcome',
    },
  },

  {
    slug: 'measurement',
    title: 'Measurement and shots',
    blurb: 'Exact probabilities are a convenience of simulation. Hardware gives you counts.',
    lesson: '/theory/measurement',
    body: [
      {
        kind: 'text',
        text: 'A state vector is something only a simulator can hand you. A real machine gives you one bit per run, so you run it many times and count.',
      },
      {
        kind: 'code',
        code: `state = Statevector.from_instruction(circuit)
print(state.probabilities_dict())      # exact, simulation only
print(state.sample_counts(1000))       # what 1000 runs might look like`,
      },
      {
        kind: 'text',
        text: 'Run the sampling twice and the numbers move. That wobble is **shot noise**, and it shrinks as $1/\\sqrt{N}$ — to halve your error you need four times the runs.',
      },
      {
        kind: 'text',
        text: 'A measurement can also be an instruction in the circuit itself. `circuit.measure_all()` adds a measurement to every wire, which is what you do before sending a job to hardware.',
      },
      {
        kind: 'note',
        text: 'Statevector cannot run a circuit that contains measurements — collapse is not a unitary operation. Add measurements last, or use sample_counts on the unmeasured circuit.',
      },
    ],
    task: {
      prompt:
        'Build the even superposition again, then add a measurement to the wire so the circuit is ready for hardware.',
      starter: `from qiskit import QuantumCircuit

circuit = QuantumCircuit(1)

# Superposition, then measure


print(circuit)`,
      hint: 'circuit.h(0), then circuit.measure_all(). Printing the circuit shows the measurement box.',
      solution: measuredPlus,
      grade: 'distribution',
      target: 'a superposition with a measurement on the wire',
    },
  },

  {
    slug: 'entanglement',
    title: 'Two qubits, and entanglement',
    blurb: 'The controlled-NOT, and the first state that cannot be taken apart.',
    lesson: '/algorithms/bell-states',
    body: [
      {
        kind: 'text',
        text: 'With two wires, a gate can act on one qubit **depending on** another. `circuit.cx(control, target)` flips the target only where the control is |1⟩.',
      },
      { kind: 'code', code: `circuit.cx(0, 1)   # control 0, target 1` },
      {
        kind: 'text',
        text: 'On its own that is ordinary logic. The interesting case is a control that is in superposition: then both branches happen at once, and the two qubits end up with no separate states of their own.',
      },
      {
        kind: 'code',
        code: `circuit.h(0)      # control is now half |0> and half |1>
circuit.cx(0, 1)  # so the target both flips and does not`,
        caption: 'The result is (|00⟩ + |11⟩)/√2 — a Bell state.',
      },
      {
        kind: 'note',
        text: 'Measure either qubit and the other is decided instantly, however far apart they are. Neither qubit has a state you could write down alone; only the pair does.',
      },
    ],
    task: {
      prompt: 'Build the Bell state (|00⟩ + |11⟩)/√2 on two qubits.',
      starter: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(2)

# Two lines: a superposition, then a controlled flip


print(Statevector.from_instruction(circuit).probabilities_dict())`,
      hint: 'Hadamard on qubit 0, then cx from 0 to 1. Starting on qubit 1 instead works just as well.',
      solution: bell,
      grade: 'state',
      target: '(|00⟩ + |11⟩)/√2 — 50% on |00⟩ and 50% on |11⟩, and nothing else',
    },
  },

  {
    slug: 'controlled-gates',
    title: 'Controls, chained',
    blurb: 'Building a three-qubit state, and gates with more than one control.',
    lesson: '/theory/entanglement',
    body: [
      {
        kind: 'text',
        text: 'Controls compose. Entangle a pair, then use one of them as the control for a third wire, and all three become correlated.',
      },
      {
        kind: 'code',
        code: `circuit.h(0)
circuit.cx(0, 1)
circuit.cx(1, 2)`,
        caption: 'A GHZ state: (|000⟩ + |111⟩)/√2.',
      },
      {
        kind: 'text',
        text: 'Any gate can carry a control. `circuit.cz(0, 1)` applies Z to one wire conditioned on the other — and because Z is diagonal, a controlled-Z is symmetric: it does not matter which wire you call the control.',
      },
      {
        kind: 'text',
        text: 'Two controls are also available. `circuit.ccx(0, 1, 2)` is the Toffoli gate: flip qubit 2 only when both 0 and 1 are set.',
      },
      {
        kind: 'note',
        text: 'GHZ is fragile in a way a Bell pair is not: lose one qubit of a GHZ trio and the remaining two are left with no entanglement at all.',
      },
    ],
    task: {
      prompt: 'Build the three-qubit GHZ state (|000⟩ + |111⟩)/√2.',
      starter: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(3)

# Superpose one wire, then chain the correlation along


print(Statevector.from_instruction(circuit).probabilities_dict())`,
      hint: 'h(0), then cx(0, 1), then cx(1, 2). Chaining from 0 to 2 directly works too.',
      solution: ghz,
      grade: 'state',
      target: '(|000⟩ + |111⟩)/√2 — only |000⟩ and |111⟩, at 50% each',
    },
  },

  {
    slug: 'grover',
    title: "Grover's search, in code",
    blurb: 'Everything so far, assembled into an algorithm that beats classical search.',
    lesson: '/algorithms/grovers-search',
    body: [
      {
        kind: 'text',
        text: 'Searching two qubits means four possibilities. Classically you check them one at a time. Grover marks the answer with a phase, then converts that invisible phase into probability.',
      },
      {
        kind: 'text',
        text: 'The **oracle** flips the sign of the marked state. To mark |11⟩ that is exactly a controlled-Z, which is negative only when both wires are |1⟩.',
      },
      { kind: 'code', code: `circuit.cz(0, 1)   # flips the sign of |11>, and nothing else` },
      {
        kind: 'text',
        text: 'After the oracle the probabilities are unchanged — all four still 25%. The marking is entirely in the sign. The **diffuser** is what turns it into an answer: H, X, controlled-Z, X, H on every wire.',
      },
      {
        kind: 'code',
        code: `circuit.h([0, 1])
circuit.x([0, 1])
circuit.cz(0, 1)
circuit.x([0, 1])
circuit.h([0, 1])`,
        caption: 'The diffuser: a reflection about the average amplitude.',
      },
      {
        kind: 'note',
        text: 'A controlled-Z is symmetric, so cz(0, 1) and cz(1, 0) are the SAME gate. Writing both applies it twice and it cancels — the marking silently vanishes and the search stops searching.',
      },
    ],
    task: {
      prompt:
        'Build Grover for two qubits, marking |11⟩, with one iteration. Done right it finds the answer with certainty.',
      starter: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(2)

# 1. Superpose both wires
# 2. Oracle: mark |11>
# 3. Diffuser: h, x, cz, x, h


print(Statevector.from_instruction(circuit).probabilities_dict())`,
      hint: 'h([0,1]) — cz(0,1) — then h([0,1]), x([0,1]), cz(0,1), x([0,1]), h([0,1]).',
      solution: grover,
      grade: 'state',
      target: '|11⟩ with certainty — 100%, everything else zero',
    },
  },
]

export const getPythonLesson = (slug: string): PythonLesson | undefined =>
  PYTHON_LESSONS.find((l) => l.slug === slug)

export const pythonLessonIndex = (slug: string): number =>
  PYTHON_LESSONS.findIndex((l) => l.slug === slug)
