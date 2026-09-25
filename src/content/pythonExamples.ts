/**
 * Starter programs for the Python Lab.
 *
 * Each one is a circuit the site already teaches, written in real Qiskit, so a learner can put the
 * lesson and the code side by side. They use only `qiskit.quantum_info`, which ships with Qiskit —
 * no Aer, nothing extra to install.
 *
 * Every example leaves its circuit in a variable named `circuit`, which is what the service looks
 * for when offering to put it on the board.
 */

export interface PythonExample {
  id: string
  title: string
  blurb: string
  code: string
  /** Lesson this mirrors, as a site path. */
  lesson?: string
}

export const PYTHON_EXAMPLES: PythonExample[] = [
  {
    id: 'bell',
    title: 'Bell state',
    blurb: 'The canonical entangled pair: one Hadamard and one CNOT.',
    lesson: '/algorithms/bell-states',
    code: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(2)
circuit.h(0)
circuit.cx(0, 1)

state = Statevector.from_instruction(circuit)
print(circuit)

# probabilities_dict() hands back numpy types, so format them rather than printing the dict raw.
for label, p in sorted(state.probabilities_dict().items()):
    print(f"{label}  {float(p):6.1%}")
`,
  },
  {
    id: 'ordering',
    title: 'Which qubit is which',
    blurb:
      'Qiskit numbers qubits from the right, this site from the left. Run it and compare the two.',
    lesson: '/theory/dirac-notation',
    code: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

# Excite ONLY qubit 0, and ask Qiskit what it sees.
circuit = QuantumCircuit(3)
circuit.x(0)

state = Statevector.from_instruction(circuit)
for label, p in sorted(state.probabilities_dict().items()):
    print(f"Qiskit says: {label}  {float(p):6.1%}")

# Qiskit prints 001, because for Qiskit qubit 0 is the RIGHTMOST character.
# This site writes q0 leftmost, so it draws the same state on its BOTTOM wire.
# Load this into the Circuit Lab and you will see |001> there too -- the wires are
# flipped precisely so that both descriptions agree about the physics.
`,
  },
  {
    id: 'grover',
    title: "Grover's search",
    blurb: 'Two qubits, one iteration, marked state |11⟩ — the circuit from the lesson.',
    lesson: '/algorithms/grovers-search',
    code: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(2)

circuit.h([0, 1])          # even superposition over all four states
circuit.cz(0, 1)           # oracle: flip the sign of |11>
circuit.h([0, 1])          # diffuser: reflect about the mean
circuit.x([0, 1])
circuit.cz(0, 1)
circuit.x([0, 1])
circuit.h([0, 1])

state = Statevector.from_instruction(circuit)
for label, p in sorted(state.probabilities_dict().items()):
    print(f"{label}  {p:6.1%}")
`,
  },
  {
    id: 'shots',
    title: 'Sampling with shots',
    blurb: 'Exact probabilities are a fiction of simulation. Real hardware gives you counts.',
    lesson: '/math/probability',
    code: `from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector

circuit = QuantumCircuit(3)
circuit.h(0)
circuit.cx(0, 1)
circuit.cx(1, 2)          # GHZ: all three rise and fall together

state = Statevector.from_instruction(circuit)
exact = state.probabilities_dict()
counts = state.sample_counts(1000)

for label in sorted(exact):
    print(f"{label}   exact {float(exact[label]):6.1%}   sampled {int(counts.get(label, 0)):4d}/1000")
print()
print("The counts wobble around the exact values. That wobble is shot noise,")
print("and it is what real hardware returns too.")
`,
  },
]

export const getPythonExample = (id: string): PythonExample | undefined =>
  PYTHON_EXAMPLES.find((e) => e.id === id)
