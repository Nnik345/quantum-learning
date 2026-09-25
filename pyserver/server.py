"""
The Python service behind the site's Python Lab.

Real Qiskit cannot run in a browser — its Rust core (`qiskit._accelerate`) has no WebAssembly wheel,
and `qiskit-terra` has never published a pure-Python one. So Python runs here instead, in the same
shape the project already uses for Ollama: a process on this machine, behind a Vite proxy, with
nothing leaving the box.

Two defences, which protect against different things:

  SANDBOX      Every submission runs inside bubblewrap: read-only system, private scratch directory,
               no network, no view of your home. This is what makes it safe to let other people
               submit code. Required by default; PY_SANDBOX=off disables it deliberately and loudly.

  ORIGIN CHECK Only pages served by the dev server may POST. This stops a malicious website you
               happen to visit from quietly driving this service through your browser. It does NOT
               stop someone you have given tunnel access from sending whatever they like — only the
               sandbox protects you there.
"""

from __future__ import annotations

import os
import resource
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from sandbox import availability, wrap

RUNNER = Path(__file__).parent / "runner.py"

MEMORY_LIMIT_BYTES = int(os.environ.get("PY_MEMORY_LIMIT_MB", "4096")) * 1024 * 1024
WALL_TIMEOUT_S = float(os.environ.get("PY_TIMEOUT_S", "15"))
CPU_TIMEOUT_S = int(WALL_TIMEOUT_S) + 5
MAX_CODE_BYTES = 100_000

SANDBOX_REQUESTED = os.environ.get("PY_SANDBOX", "on").lower() != "off"
SANDBOX_OK, SANDBOX_DETAIL = availability() if SANDBOX_REQUESTED else (False, "disabled by PY_SANDBOX=off")
SANDBOXED = SANDBOX_REQUESTED and SANDBOX_OK

# Origins allowed to POST. The dev server and the preview server, on either spelling of localhost.
# Sharing over a LAN address instead of an SSH tunnel means adding it here.
DEFAULT_ORIGINS = ",".join(
    f"http://{host}:{port}" for host in ("localhost", "127.0.0.1") for port in (5173, 4173)
)
ALLOWED_ORIGINS = {
    o.strip() for o in os.environ.get("PY_ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()
}

app = FastAPI(title="Quantum Learning Python service")


class RunRequest(BaseModel):
    code: str = Field(default="", max_length=MAX_CODE_BYTES)


@app.middleware("http")
async def only_from_the_site(request: Request, call_next):
    """
    Reject browser requests that did not come from the site.

    A browser always sends `Origin` on a POST and cannot forge it, so an allowlist is enough to stop
    a page you are visiting from driving this service. A request with no Origin is not from a
    browser; it came from a process on this machine, which can already do anything, so it passes.
    """
    origin = request.headers.get("origin")
    if request.method == "POST" and origin is not None and origin not in ALLOWED_ORIGINS:
        return JSONResponse(
            status_code=403,
            content={
                "error": (
                    f"Refused: {origin} is not an allowed origin. Requests must come from the dev "
                    "server. Set PY_ALLOWED_ORIGINS if you are serving the site from another address."
                )
            },
        )
    return await call_next(request)


def _apply_limits() -> None:
    """
    Run in the child between fork and exec. Inherited through bwrap into the submission.

    These cap what a program may CONSUME. What it may reach is the sandbox's job.
    """
    resource.setrlimit(resource.RLIMIT_AS, (MEMORY_LIMIT_BYTES, MEMORY_LIMIT_BYTES))
    resource.setrlimit(resource.RLIMIT_CPU, (CPU_TIMEOUT_S, CPU_TIMEOUT_S))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    os.setsid()


@app.get("/health")
def health() -> dict:
    """Whether the service can run Qiskit, and under what protection."""
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
        "sandboxed": SANDBOXED,
        "sandboxDetail": SANDBOX_DETAIL,
    }


@app.post("/run")
def run(request: RunRequest) -> dict:
    if not request.code.strip():
        return {"stdout": "", "stderr": "", "error": "There is no code to run.", "durationMs": 0}

    if SANDBOX_REQUESTED and not SANDBOX_OK:
        # Refusing beats running unprotected: the whole point of the default is that someone
        # sharing this page does not silently lose the protection they think they have.
        return {
            "stdout": "",
            "stderr": "",
            "error": (
                f"Refusing to run: the sandbox is unavailable — {SANDBOX_DETAIL}. "
                "Install bubblewrap, or set PY_SANDBOX=off if you accept running code unprotected."
            ),
            "durationMs": 0,
        }

    started = time.monotonic()

    with tempfile.TemporaryDirectory(prefix="qlrun-") as workdir:
        # Everything the run needs lives in the one directory the sandbox can write, so the
        # sandboxed and unsandboxed paths are otherwise identical.
        shutil.copy2(RUNNER, Path(workdir) / "runner.py")
        (Path(workdir) / "submission.py").write_text(request.code, encoding="utf-8")

        root = "/work" if SANDBOXED else workdir
        command = [sys.executable, f"{root}/runner.py", f"{root}/submission.py", f"{root}/result.json"]
        if SANDBOXED:
            command = wrap(command, workdir)

        try:
            completed = subprocess.run(
                command,
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

        payload = _read_result(Path(workdir) / "result.json")

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

    banner = (
        "sandboxed with bubblewrap"
        if SANDBOXED
        else f"NOT SANDBOXED - {SANDBOX_DETAIL}. Submitted code runs as you, with your permissions."
    )
    print(f"[quantum-learning] {banner}")
    print(f"[quantum-learning] accepting POSTs from: {', '.join(sorted(ALLOWED_ORIGINS))}")

    # 127.0.0.1 is deliberate. Share the SITE over an SSH tunnel, never this port.
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PY_PORT", "8000")))
