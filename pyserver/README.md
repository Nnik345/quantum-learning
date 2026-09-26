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
| `PY_SANDBOX` | `on` | `off` runs code unprotected, deliberately |
| `PY_ALLOWED_ORIGINS` | localhost/127.0.0.1 on 5173 and 4173 | Comma-separated origins allowed to POST |

Because the proxy runs inside the Vite process, `localhost` means *the machine Vite is on*. The
service needs no GPU, so running it next to Vite is the simplest choice even when Ollama is elsewhere.

## Security

Submitted code runs inside **bubblewrap**: a read-only system, a private scratch directory, no
network, and no view of your home. Writes to anything outside the scratch land in an ephemeral root
and vanish when the run ends. Verified, not assumed:

```
/home/<you>/.bashrc      False
/home/<you>/.ssh/id_rsa  False
/etc/passwd              False
network                  blocked
```

The sandbox is **required by default**. If bubblewrap is missing or namespaces are unavailable, the
service refuses to run anything and says why, rather than quietly falling back to running code with
your permissions. `PY_SANDBOX=off` opts out deliberately; the startup banner and `/health` both
report it, and the page shows a red warning.

Resource limits still apply inside the sandbox: a wall-clock timeout, an address-space cap, a CPU cap
and its own session.

### Who may submit

`/run` accepts POSTs only from allowed origins — by default the dev server and preview server on
`localhost` and `127.0.0.1`. A browser cannot forge `Origin`, so this refuses a page that tries to
reach this service directly on port 8000.

Requests with no `Origin` are not from a browser and are allowed; they come from a process on this
machine, which can already do anything.

**This is not access control.** The dev server rewrites `Origin` to the loopback origin on everything
it proxies (`src/lib/devProxy.ts`), so anything that can reach the dev server can reach this service
through it. That is deliberate — otherwise serving the site on any non-loopback address breaks every
feature here — but it means the allowlist only guards direct access to port 8000. **The sandbox is
what protects you from whoever can reach the dev server.**

`PY_ALLOWED_ORIGINS` exists for setups that bypass the dev server; the ordinary path needs no
configuration.

The service binds to `127.0.0.1`. Expose the dev server, never this port.

## Serving the site to another machine

An SSH tunnel to the dev server is enough:

```sh
# on the other machine
ssh -L 5173:localhost:5173 you@your-box
```

Everything works there with no configuration — the proxy normalises the origin, and submitted code
runs sandboxed.

## Contract

```
GET  /health  -> { ok, qiskit, python, timeoutSeconds }
POST /run     -> { stdout, stderr, error?, circuit?, circuitError?, durationMs }
```

`/run` returns the circuit if the script leaves one in a variable named `circuit` (otherwise the last
`QuantumCircuit` it defined), serialised in **Qiskit's own qubit indices**. The flip to this site's
convention happens in `src/lib/python/qiskitOrder.ts`, so wire ordering has one place it can be wrong
rather than two.
