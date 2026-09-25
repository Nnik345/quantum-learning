# Python service

Runs the code written in the site's Python Lab, with **real Qiskit**.

Qiskit cannot run in the browser: its Rust core (`qiskit._accelerate`) has no WebAssembly wheel, and
`qiskit-terra` has never published a pure-Python one — so `micropip.install("qiskit")` fails at every
version. Python therefore runs here, in the same shape this project already uses for Ollama: a local
process behind a Vite proxy, with nothing leaving the machine.

## Setup

This project uses **pyenv**, not `.venv`. Python 3.14.7 is verified to work — `qiskit` ships an
`abi3` wheel valid for 3.10+, lists 3.14 in its classifiers, and `numpy`, `scipy` and `rustworkx` all
publish `cp314` linux wheels, so nothing builds from source.

```sh
pyenv virtualenv 3.14.7 quantum-learning
cd ~/Projects/quantum-learning
pyenv local quantum-learning
pip install -r pyserver/requirements.txt
```

## Running

In its own terminal, like `ollama serve`:

```sh
python pyserver/server.py
```

It listens on `127.0.0.1:8000`. Vite proxies `/pyserver` to it, so the browser only ever talks to the Vite
origin — no CORS, and it tunnels over SSH exactly like Ollama does.

| Variable | Default | Meaning |
|---|---|---|
| `PY_PORT` | `8000` | Port to listen on |
| `PY_TIMEOUT_S` | `15` | Wall-clock limit per run |
| `PY_MEMORY_LIMIT_MB` | `4096` | Address-space cap per run |
| `PY_URL` (read by Vite) | `http://localhost:8000` | Where the site looks for this service |

Because the proxy runs inside the Vite process, `localhost` means *the machine Vite is on*. The
service needs no GPU, so running it next to Vite is the simplest choice even when Ollama is elsewhere.

## Security

**Do not expose this port.** This executes code that arrives over HTTP.

Each submission runs in a fresh subprocess with a wall-clock timeout, an address-space cap, a CPU cap
and its own session, so a runaway loop or an accidental allocation is stopped. That is the limit of
what it does. There is **no filesystem or network isolation** — that needs namespaces or a container.
It binds to `127.0.0.1` for exactly this reason, and it is intended for local development only.

## Contract

```
GET  /health  -> { ok, qiskit, python, timeoutSeconds }
POST /run     -> { stdout, stderr, error?, circuit?, circuitError?, durationMs }
```

`/run` returns the circuit if the script leaves one in a variable named `circuit` (otherwise the last
`QuantumCircuit` it defined), serialised in **Qiskit's own qubit indices**. The flip to this site's
convention happens in `src/lib/python/qiskitOrder.ts`, so wire ordering has one place it can be wrong
rather than two.
