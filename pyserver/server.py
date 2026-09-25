"""
The Python service behind the site's Python Lab.

Real Qiskit cannot run in a browser — its Rust core (`qiskit._accelerate`) has no WebAssembly wheel,
and `qiskit-terra` has never published a pure-Python one. So Python runs here instead, in the same
shape the project already uses for Ollama: a process on this machine, behind a Vite proxy, with
nothing leaving the box.

SECURITY: this runs code that arrives over HTTP. Each submission executes in a fresh subprocess with
a wall-clock timeout and memory and CPU caps, which is enough to stop a runaway loop or an accidental
allocation — it is NOT a sandbox. There is no filesystem or network isolation, which would need
namespaces or a container. It binds to 127.0.0.1 for that reason. Do not expose this port.
"""

from __future__ import annotations

import os
import resource
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel, Field

RUNNER = Path(__file__).parent / "runner.py"

# Generous enough for numpy and scipy, which reserve a lot of address space on import, and still low
# enough that a runaway allocation fails fast rather than taking the machine down with it.
MEMORY_LIMIT_BYTES = int(os.environ.get("PY_MEMORY_LIMIT_MB", "4096")) * 1024 * 1024
WALL_TIMEOUT_S = float(os.environ.get("PY_TIMEOUT_S", "15"))
CPU_TIMEOUT_S = int(WALL_TIMEOUT_S) + 5
MAX_CODE_BYTES = 100_000

app = FastAPI(title="Quantum Learning Python service")


class RunRequest(BaseModel):
    code: str = Field(default="", max_length=MAX_CODE_BYTES)


def _apply_limits() -> None:
    """
    Run in the child between fork and exec.

    A new session means a timeout can kill the whole process group, so a script that spawns
    something does not leave it running after the request is gone.
    """
    resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT_BYTES, MEMORY_LIMIT_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU, (CPU_TIMEOUT_S, CPU_TIMEOUT_S))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.setsid()


@app.get("/health")
def health() -> dict:
    """Whether the service can actually run Qiskit, and which version the learner is writing against."""
    try:
        import qiskit

        version = qiskit.__version__
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"qiskit is not importable: {exc}", "python": sys.version.split()[0]}

    return {
        "ok": True,
        "qiskit": version,
        "python": sys.version.split()[0],
        "timeoutSeconds": WALL_TIMEOUT_S,
    }


@app.post("/run")
def run(request: RunRequest) -> dict:
    if not request.code.strip():
        return {"stdout": "", "stderr": "", "error": "There is no code to run.", "durationMs": 0}

    started = time.monotonic()

    with tempfile.TemporaryDirectory(prefix="qlrun-") as workdir:
        code_path = Path(workdir) / "submission.py"
        result_path = Path(workdir) / "result.json"
        code_path.write_text(request.code, encoding="utf-8")

        try:
            completed = subprocess.run(
                [sys.executable, str(RUNNER), str(code_path), str(result_path)],
                capture_output=True,
                text=True,
                timeout=WALL_TIMEOUT_S,
                cwd=workdir,
                preexec_fn=_apply_limits,
                env={
                    "PATH": os.environ.get("PATH", ""),
                    "HOME": workdir,
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
            )
        except subprocess.TimeoutExpired as expired:
            return {
                "stdout": _text(expired.stdout),
                "stderr": "",
                "error": (
                    f"Stopped after {WALL_TIMEOUT_S:g} seconds. "
                    "An infinite loop, or a circuit far larger than it looks?"
                ),
                "durationMs": round((time.monotonic() - started) * 1000),
            }

        payload = _read_result(result_path)

    error = payload.get("error")
    if error is None and completed.returncode != 0:
        # Killed by a limit rather than raising — RLIMIT_AS surfaces as a MemoryError inside the
        # process, but an OOM kill or a CPU limit takes it out before it can report anything.
        error = (
            f"The program was stopped (exit code {completed.returncode}). "
            "It most likely ran out of memory or CPU time."
        )

    return {
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "error": error,
        "circuit": payload.get("circuit"),
        "circuitError": payload.get("circuitError"),
        "durationMs": round((time.monotonic() - started) * 1000),
    }


def _text(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return value if isinstance(value, str) else ""


def _read_result(path: Path) -> dict:
    """A missing or corrupt result file means the child died before writing; not an error in itself."""
    import json

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {}


if __name__ == "__main__":
    import uvicorn

    # 127.0.0.1 is deliberate; see the module docstring.
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PY_PORT", "8000")))
