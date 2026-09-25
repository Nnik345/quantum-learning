"""
Executes one submitted script and reports what it did.

Runs as a throwaway subprocess, never inside the service. Its stdout is the learner's stdout and
nothing else — the structured result goes to a separate file, so a script that prints JSON cannot
impersonate the runner.

Usage: runner.py <code-file> <result-file>
"""

from __future__ import annotations

import json
import sys
import traceback

# Qiskit instruction name -> the gate spelling the site's validator understands.
#
# Multi-qubit entries are left as aliases (CX, CZ, CCX, ...) on purpose: the validator already
# expands those and takes their leading wires as controls, which is exactly Qiskit's argument
# order, so there is no second place to get control/target the wrong way round.
GATE_NAMES = {
    "id": "I",
    "x": "X",
    "y": "Y",
    "z": "Z",
    "h": "H",
    "s": "S",
    "sdg": "Sdg",
    "t": "T",
    "tdg": "Tdg",
    "rx": "RX",
    "ry": "RY",
    "rz": "RZ",
    "p": "P",
    "u1": "P",
    "phase": "P",
    "swap": "SWAP",
    "measure": "MEASURE",
    "cx": "CX",
    "cnot": "CX",
    "cy": "CY",
    "cz": "CZ",
    "ccx": "CCX",
    "toffoli": "CCX",
    "ccz": "CCZ",
    "cswap": "CSWAP",
    "fredkin": "CSWAP",
    "cp": "CP",
    "cu1": "CP",
    "crz": "CRZ",
}

# Structural instructions that carry no gate.
IGNORED = {"barrier", "delay"}


def describe_circuit(qc) -> dict:
    """
    A QuantumCircuit as plain JSON, in QISKIT's own qubit indices.

    The index flip to this site's convention happens in TypeScript, in one tested function, so the
    wire ordering has exactly one place it can be wrong rather than two.

    Columns are packed greedily here because the site's validator requires one per gate. A gate
    reserves every wire between its lowest and highest, matching how the board reserves the wires a
    control line crosses.
    """
    gates = []
    unsupported = []
    next_free = [0] * qc.num_qubits

    for instruction in qc.data:
        name = instruction.operation.name.lower()
        if name in IGNORED:
            continue

        mapped = GATE_NAMES.get(name)
        if mapped is None:
            unsupported.append(instruction.operation.name)
            continue

        wires = [qc.find_bit(q).index for q in instruction.qubits]
        if not wires:
            continue

        column = max(next_free[w] for w in range(min(wires), max(wires) + 1))
        for w in range(min(wires), max(wires) + 1):
            next_free[w] = column + 1

        gate = {"gate": mapped, "targets": wires, "controls": [], "column": column}

        params = [float(p) for p in instruction.operation.params if isinstance(p, (int, float))]
        if params:
            gate["angle"] = params[0]

        gates.append(gate)

    return {
        "numQubits": qc.num_qubits,
        "gates": gates,
        "unsupported": sorted(set(unsupported)),
    }


def find_circuit(namespace: dict):
    """
    The circuit to hand back to the board.

    Prefers one the script named `circuit`, since that is what the page asks for; otherwise takes
    the last QuantumCircuit defined, so a script that only built `qc` still works.
    """
    try:
        from qiskit import QuantumCircuit
    except Exception:
        return None

    named = namespace.get("circuit")
    if isinstance(named, QuantumCircuit):
        return named

    found = [v for v in namespace.values() if isinstance(v, QuantumCircuit)]
    return found[-1] if found else None


def main() -> int:
    code_path, result_path = sys.argv[1], sys.argv[2]
    with open(code_path, encoding="utf-8") as f:
        source = f.read()

    result: dict = {"error": None, "circuit": None}
    namespace: dict = {"__name__": "__main__"}

    try:
        exec(compile(source, "<your code>", "exec"), namespace)
    except SystemExit:
        pass
    except BaseException as exc:
        # The traceback is the most useful thing a learner gets back, so it is passed through whole
        # rather than reduced to a message — but the first frame is this runner's own `exec` call,
        # which is noise they cannot act on. Dropping it leaves only their code.
        tb = exc.__traceback__
        result["error"] = "".join(
            traceback.format_exception(type(exc), exc, tb.tb_next if tb else None)
        ).rstrip()

    try:
        qc = find_circuit(namespace)
        if qc is not None:
            result["circuit"] = describe_circuit(qc)
    except Exception as exc:  # noqa: BLE001 - reporting beats crashing the run
        result["circuitError"] = f"Could not read the circuit: {exc}"

    sys.stdout.flush()
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result, f)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
