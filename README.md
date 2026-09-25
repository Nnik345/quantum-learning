# QuantumLearn

An interactive site for learning quantum computing, from complex numbers to Shor's algorithm. It has
a real state-vector simulator, a drag-and-drop circuit board, auto-graded exercises, a tutor that
runs on a local LLM, and a Qiskit course you work through by typing the code yourself.

Everything runs on your own machine. Nothing is sent anywhere.

> **Status: proof of concept.** All 22 lessons are written and the simulator is thoroughly tested,
> but this is a local development project, not a deployed product. See [Security](#security) before
> exposing any part of it.

---

## Contents

| Section | What it covers |
| --- | --- |
| [What you can do](#what-you-can-do) | The four things this site is |
| [Setup](#setup) | **Start here.** Three tiers, each usable on its own |
| [Running it](#running-it) | Day-to-day commands and ports |
| [Sharing it for testing](#sharing-it-for-testing) | Letting someone else try it over SSH |
| [The learning path](#the-learning-path) | 22 steps across 6 stages |
| [Exercises](#exercises) | How auto-grading works, and why it grades behaviour |
| [The Circuit Lab](#the-circuit-lab) | The simulator and the board |
| [The AI tutor](#the-ai-tutor) | Model, tools, and the rule that keeps it honest |
| [Python and Qiskit](#python-and-qiskit) | The guide, the playground, and the bit-order flip |
| [Conventions](#conventions) | Qubit ordering and measurement — read before comparing to Qiskit |
| [Repository layout](#repository-layout) | Where everything lives |
| [Writing content](#writing-content) | Adding or editing lessons |
| [Tests and evaluation](#tests-and-evaluation) | 533 tests, plus a live-model eval |
| [What was measured](#what-was-measured) | Findings that changed decisions |
| [Future work](#future-work) | What is worth doing next |
| [Security](#security) | The honest limits |

---

## What you can do

**Follow a path.** 22 lessons in one order that makes sense, with maths and theory interleaved with
the algorithms that use them. Progress is remembered locally.

**Build circuits.** A board with 15 gates and up to 8 qubits, showing the state vector, probabilities,
per-qubit Bloch vectors and sampled shots as you drag. Every algorithm on the site ships a circuit you
can open and take apart.

**Get checked.** Exercises grade what your circuit *does*, not how you arranged it.

**Ask.** A tutor running on a local model that reads the site's own pages, looks up verified circuits,
and checks anything it builds against the simulator before showing it.

**Write Qiskit.** A six-lesson course with real Qiskit 2.5.2 running locally, plus an open playground.
Circuits you build in Python load straight onto the board.

---

## Setup

Three tiers. **Tier 1 alone gives you a fully working site** — lessons, circuit lab, exercises,
progress. Tiers 2 and 3 add the tutor and Python; without them those pages show a notice explaining
what to start, and nothing else breaks.

### Prerequisites

| | Version | Needed for | Notes |
| --- | --- | --- | --- |
| Node.js | 20+ | Tier 1 | Tested on 26.8.2 |
| Ollama | 0.34+ | Tier 2 | Tested on 0.34.4 |
| GPU | ~8 GB VRAM | Tier 2 | Tested on an RTX 3060 12 GB. CPU works but is slow |
| Python | 3.10–3.14 | Tier 3 | Tested on 3.14.7 |
| pyenv | any | Tier 3 | Or any environment manager you prefer |
| bubblewrap | any | Tier 3 | Sandboxes submitted code. **Required by default** |

### Tier 1 — the site

```sh
git clone <this repo>
cd quantum-learning
npm install
npm run dev
```

Open **http://localhost:5173**. You should see the landing page with a `22 / 6 / 12 / 15 / 8` stats
row. The path, the Circuit Lab and the exercises all work now. Stop here if that is all you want.

### Tier 2 — the AI tutor

Install Ollama and pull the model. On Arch:

```sh
sudo pacman -S ollama-cuda        # or `ollama` for CPU-only
sudo systemctl enable --now ollama
ollama pull qwen3.5:9b            # ~6.6 GB, Q4_K_M
```

Check it landed entirely on the GPU:

```sh
ollama ps
```

The **PROCESSOR** column should read `100% GPU`. Any CPU percentage means the model spilled out of
VRAM and generation will be several times slower — on a 12 GB card this model has 4 GB to spare, so
that should not happen.

Optionally, `sudo systemctl edit ollama`:

```ini
[Service]
Environment="OLLAMA_KEEP_ALIVE=30m"
Environment="OLLAMA_NUM_PARALLEL=1"
```

Reload the site and click **Ask** in the bottom right. `OLLAMA_MODEL` and `OLLAMA_NUM_CTX` override
the defaults if you want to try another model.

### Tier 3 — Python with real Qiskit

Qiskit cannot run in a browser: its Rust core (`qiskit._accelerate`) publishes no WebAssembly wheel,
and `qiskit-terra` has never published a pure-Python one — so `micropip.install("qiskit")` fails at
every version. Python therefore runs in a small local service, the same shape as Ollama.

```sh
sudo pacman -S bubblewrap             # apt install bubblewrap on Debian/Ubuntu

pyenv virtualenv 3.14.7 quantum-learning
pyenv local quantum-learning          # writes .python-version, which is gitignored
pip install -r pyserver/requirements.txt
```

Then start it in its own terminal:

```sh
python pyserver/server.py
```

It listens on `127.0.0.1:8000` and prints `sandboxed with bubblewrap` on startup. Visit
**http://localhost:5173/python** — the header should read
`● Qiskit 2.5.2 on Python 3.14.7 · 15s limit per run · sandboxed`. A red warning there means code
would run unprotected; see [Security](#security).

Python 3.14.7 is verified: `qiskit` ships an `abi3` wheel valid for 3.10+, lists 3.14 in its
classifiers, and `numpy`, `scipy` and `rustworkx` all publish `cp314` linux wheels — nothing compiles
from source. 3.13 works too if you prefer.

---

## Running it

Three processes, each in its own terminal:

| Service | Command | Port | Without it |
| --- | --- | --- | --- |
| Site | `npm run dev` | 5173 | nothing works |
| Ollama | `systemctl start ollama` | 11434 | the tutor says it is offline |
| Python | `python pyserver/server.py` | 8000 | the Python pages say what to start |

The browser only ever talks to the Vite origin; `/ollama` and `/pyserver` are proxied to the two
services. That means **no CORS to configure**, and an SSH tunnel needs no code change:

```sh
ssh -L 11434:localhost:11434 user@gpu-box
```

Because the proxy runs inside the Vite process, `localhost` means *the machine Vite is on*. The Python
service needs no GPU, so running it next to Vite is simplest even when Ollama is elsewhere. `OLLAMA_URL`
and `PY_URL` retarget them.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm test` | 533 tests. Never needs Ollama or Python |
| `npm run test:watch` | Same, watching |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run build` | Typecheck then production build |
| `npm run eval` | Scores the tutor against a live Ollama (14 cases) |

---

## Sharing it for testing

Give a tester an SSH tunnel to the dev server. Nothing else needs to change:

```sh
# on the tester's machine
ssh -L 5173:localhost:5173 you@your-box
```

They open `http://localhost:5173` and get the whole site, including Python. Their code runs in the
sandbox, and their browser sends an origin the service already allows.

Two rules:

- **Tunnel 5173 only.** Never expose 8000 or 11434. The site reaches both through the Vite proxy.
- **Check the sandbox is on first.** The Python page says `· sandboxed` when it is, and shows a red
  warning when it is not. Do not share a page showing that warning — submitted code would run with
  your permissions.

Serving on a LAN address instead (`npm run dev -- --host`) means telling the service about it, since
the origin changes:

```sh
PY_ALLOWED_ORIGINS=http://192.168.1.50:5173 python pyserver/server.py
```

## The learning path

The front page is one ordered route rather than three parallel tracks, so nobody has to work out that
complex numbers come before Dirac notation. Maths and theory are interleaved with the algorithms that
consume them — the first real algorithm arrives at **step 9**, not after all the theory.

| Stage | Steps | Ends with |
| --- | --- | --- |
| Foundations | 1–3 | Eigenvalues, and measurement as a postulate |
| One Qubit | 4–9 | A quantum random number generator you can run |
| Many Qubits | 10–14 | Teleportation |
| Oracles & Query Complexity | 15–18 | Simon's algorithm — the first separation that survives randomisation |
| Amplitude & Phase | 19–21 | Phase estimation |
| Synthesis | 22 | Shor's algorithm |

22 topics across three tracks (`/math`, `/theory`, `/algorithms`), all written — 97 sections, 371
content blocks, no placeholders. `/reference` browses them by kind instead of by order; `/path` shows
the route. Progress lives in `localStorage`; the path shows prerequisites as a notice, never a lock.

---

## Exercises

Six exercises, one per stage, embedded in the lessons. Three kinds: a numeric **value** question, a
**predict** question about a circuit's outcome, and **build/fix** tasks that hand off to the Circuit
Lab.

**They grade behaviour, never position.** Your circuit is run and compared with a reference, so gates
in different columns, a different decomposition, a mirrored construction or a stray measurement all
pass — only a circuit that does the wrong thing fails. Three modes, because choosing wrongly is the
main way to be unfair:

- `state` — reach this state. Used when the prompt names one.
- `operation` — behave correctly on **every** input, not just `|0…0⟩`. Used for oracles.
- `distribution` — match these outcome probabilities, whatever the phases. Used when the prompt is
  about measurement results, so a task asking for "50% on each outcome" accepts `|−⟩` as readily as `|+⟩`.

Exercises can only use what the site has taught by that step. `src/content/syllabus.ts` derives that
envelope from the content itself and a test enforces it, so a lesson cannot quietly run ahead of the
writing. Solving is recorded separately from "mark complete", which stays the reader's own call.

---

## The Circuit Lab

`/circuit`. Drag gates onto up to **8 qubits**; the panels update live.

- **15 gates**: `I X Y Z H S S† T T† RX RY RZ P SWAP` and measurement, plus custom gates defined by a
  matrix (`1/sqrt(2)`, `e^(i*pi/4)` are accepted, and unitarity is checked).
- **Controls are a property of a gate**, not separate gates. A CNOT is `X` with one control, a
  Toffoli is `X` with two, a Fredkin is `SWAP` with one.
- **Per-wire inputs**: `|0⟩ |1⟩ |+⟩ |−⟩ |i⟩ |−i⟩` or custom amplitudes.
- **Panels**: state vector, probabilities, per-qubit Bloch vectors, and sampled shots with a seeded RNG.
- Step through column by column, undo/redo, import/export JSON.
- **12 verified algorithm circuits** — QRNG, Bell, superdense coding, teleportation, Deutsch,
  Deutsch–Jozsa, Bernstein–Vazirani, Simon, Grover, QFT, phase estimation, Shor — each checked
  against its textbook result in `presets.test.ts`.

Every gate goes through one `applyGate(state, matrix, targets, controls)` function. There are no
per-gate special cases, which is why non-adjacent SWAP and controlled custom gates work without
extra code.

---

## The AI tutor

A floating panel on every page, answering against a **local** model. Nothing leaves the machine.

**Model: `qwen3.5:9b` (Q4_K_M, ~6.6 GB), 8192 context, reasoning off.** All three were chosen by
measurement, not preference — see [What was measured](#what-was-measured).

### The design rule

**The model proposes; the code decides.** Nothing it says about a circuit is shown as fact. Every
proposal goes through `checkPlacement`, gets simulated, and the panel displays the **computed**
result. If the model claims a Bell state and the simulation disagrees, the simulation is what you see.

### What it can reach

Nine tools, none of which execute anything you did not ask for:

| Tool | Purpose |
| --- | --- |
| `search_content` | Whole-topic retrieval over the site, scored by term overlap, IDF and headings |
| `open_topic` | Fetch a page by name |
| `get_current_page` | The page you are on, with every circuit printed on it |
| `get_reference_circuit` | One of the 12 tested circuits — gates, real outcome, and its page |
| `propose_circuit` | Build a circuit; validated and simulated before display |
| `get_current_circuit` | Read your board |
| `run_simulation` | Exact amplitudes, probabilities and Bloch vectors |
| `get_python_code` | Your editor contents, output, traceback and current task |
| `suggest_python` | Offer code, with a button for you to insert it |

It **cites its sources**: tool results carry the page path and the prompt asks for it back as a
markdown link. `src/assistant/links.ts` then resolves every link against the real routes — external
URLs, `javascript:`, and plausible-but-wrong internal paths all render as plain text. Model output is
untrusted, and a citation feature is not worth making the page a launchpad for arbitrary URLs.

It **cannot run Python**, deliberately. The Python service has no filesystem isolation, so letting a
model execute code it wrote would be a real escalation from "only the user runs code". A test asserts
no such tool exists. It also never receives an exercise's solution — a tutor that can read the answer
will hand it over.

---

## Python and Qiskit

Real Qiskit 2.5.2, running locally. Three places:

- **`/python`** — a six-lesson guide: first circuit → superposition → measurement and shots →
  entanglement → chained controls → Grover. You read the idea, then complete a stub yourself.
- **`/python/<lesson>`** — one lesson, reading on the left, your editor on the right.
- **`/python/playground`** — an open editor with no task attached.

Tasks are graded by **running your code**, pulling the circuit out of Qiskit, and comparing behaviour
with the same `gradeAgainst` the circuit exercises use. A Bell pair built on qubit 1 with the control
reversed passes, because it is a Bell pair. Nothing compares source text.

The editor is CodeMirror 6 with the Python grammar, themed from the site's own tokens and **lazily
loaded** — a 362 KB chunk only the Python pages pay for.

### The bit order, reconciled rather than warned about

Qiskit is little-endian: qubit `i` has place value 2^i, so **q0 is the rightmost character** of a
printed bitstring. This site is the reverse. `src/lib/python/qiskitOrder.ts` maps
`siteWire = n - 1 - qiskitQubit`, and the useful consequence is that **after the flip, both systems
print the same bitstring for the same state**:

```
Qiskit:  qc.x(0) on 3 qubits   ->  001   (qubit 0 is rightmost)
Here:    X on wire 2 of 3      ->  001   (wire 0 is leftmost)
```

So the conversion resolves the conflict rather than papering over it, and one of the starter programs
demonstrates exactly that. Qiskit's own output is shown verbatim; the board shows the site's
convention; the page explains the mirroring. It lives in one function, and its tests assert that
same-bitstring property directly — verified against real Qiskit, not assumed.

Circuits come back in Qiskit's indices and go through `validateProposal`, the same validator guarding
the tutor's circuits, which already resolves `cx`/`cz`/`ccx`/`cswap`/`cp` aliases and assigns columns.

---

## Conventions

**Qubit ordering.** `q0` is the top wire and the **leftmost** symbol in a ket: `|q0 q1 q2⟩`.
Internally qubit `q` occupies bit `n - 1 - q`. This is textbook (Nielsen & Chuang) ordering and the
**reverse of Qiskit**. Three layers defend it: the convention is in the system prompt, tool results
always report bitstrings through the site's own `basisLabel`, and an eval case fails outright if
"q0 is |1⟩" comes back as `001`.

**Measurement.** A pure state-vector simulator cannot represent a post-measurement mixed state, so
two honest views are kept separate:

- State / Probabilities / Bloch show the exact **pre-measurement** state, with measurement gates
  treated as no-ops. The UI says so whenever a measurement is present.
- **Shots** runs the circuit per-shot with a seeded RNG, collapsing at each measurement gate. That is
  the correct answer for circuits with mid-circuit measurement.

**No classical feedforward.** A measurement result cannot control a later gate. Protocols that need
it, such as teleportation, use quantum controls instead (deferred measurement), and say so.

---

## Repository layout

```
pyserver/            Python service — real Qiskit, behind a Vite proxy
  server.py            FastAPI: /health and /run
  runner.py            Executes one submission in a throwaway subprocess
  requirements.txt     Pinned qiskit, fastapi, uvicorn

eval/                Live-model eval harness (not part of npm test)

src/
  lib/quantum/       Simulator core — pure TypeScript, no React
    complex.ts         Complex arithmetic
    matrix.ts          Matrix ops + the U†U = I unitarity check
    state.ts           State vector, applyGate, partial trace, Bloch vectors
    gates.ts           Built-in gate library
    circuit.ts         Circuit model and placement rules
    builder.ts         Terse builders for writing circuits in source
    simulate.ts        Analytic run + shot sampling
    equivalence.ts     Behavioural comparison — the grading engine
    presets.ts         12 verified algorithm circuits
    persist.ts         Save/load, custom gates re-validated on load
  lib/llm/           The tutor: client, tools, retrieval, prompt, validator
  lib/python/        Python client, the Qiskit bit-order flip, the tutor bridge
  circuit/           The Circuit Lab UI
  content/           Lessons, exercises, Python lessons, syllabus, grading
  components/        Tex, Bloch sphere, CodeMirror editor, layout
  learning/          Progress tracking and exercise rendering
  routes/            Page components
```

---

## Writing content

All lesson content is plain data — no JSX to edit and nothing to register by hand. Index pages,
sidebars, anchors and prev/next links are all derived from it.

- `src/content/math.ts`, `theory.ts`, `algorithms.ts` — the topics
- `src/content/registry.ts` — track order and titles
- `src/content/path.ts` — the 22-step route and its stages
- `src/content/types.ts` — the block vocabulary

A topic has an ordered `sections` array. **Reorder** by moving a line, **add** by adding an object.

```ts
{
  id: 'polar-form',              // URL anchor — keep stable once shared
  title: 'Polar Form',
  summary: 'One line, shown under the heading.',
  blocks: [
    { kind: 'text', text: 'Prose with $inline$ LaTeX, **bold** and `code`.' },
    { kind: 'math', tex: 'z = re^{i\\theta}', caption: 'Optional caption.' },
    { kind: 'list', items: ['Point one', 'Point two'], ordered: false },
    { kind: 'callout', tone: 'tip', title: 'Note', text: 'A highlighted aside.' },
    { kind: 'widget', widget: 'bloch-sphere', caption: 'Optional caption.' },
    { kind: 'circuit', preset: 'grover', caption: 'A worked circuit, by preset id.' },
    { kind: 'exercise', id: 'fix-grover-oracle' },
  ],
}
```

Widget keys live in `src/content/widgets.tsx`. Adding an exercise means adding an object to
`src/content/exercises.ts` and an `exercise` block where it should appear; the syllabus test will
fail if it needs a gate the site has not taught by that step.

---

## Tests and evaluation

```sh
npm test          # 533 tests across 19 files. No Ollama, no Python service
npm run eval      # 14 cases against a live model
npm run eval bell # just matching ids
```

`npm test` covers the simulator against known results (Bell and GHZ states, the full Toffoli truth
table, CNOT in both wire directions to catch bit-order bugs, norm preservation, reduced density
matrices, seeded sampling, non-adjacent SWAP and Fredkin), the 12 preset circuits against their
textbook results, circuit editing rules, and page-level tests driving the real drag-and-drop.

The tutor and Python add: the validator against malformed and hostile model output, retrieval, the
Qiskit bit-order flip, link rendering against hostile hrefs, exercise grading including the
correct-but-differently-shaped cases, and the whole assistant panel driven by a scripted fake model.

**The eval is different.** Temperature 0 and a fixed seed, so two runs are comparable. **Circuit
cases are scored by running the generated circuit** — a pass means the physics is right, not that the
prose sounded convincing. Text cases only check that expected words appear, which is a grounding
smoke test and nothing more; the harness says exactly that in its own output.

---

## What was measured

Findings that changed a decision, kept because each one contradicted an assumption.

### Choosing the model

The eval picked it. Qwen3-14B was the original choice; Qwen3.5-9B won outright on the same cases:

| | qwen3:14b | qwen3.5:9b |
| --- | --- | --- |
| Eval score | 11/12 | **12/12** |
| Wall time | 130s | **90s** |
| Throughput | 28 tok/s | **~50 tok/s** |
| GPU residency | 40/41 layers | **100%** |
| Resident size | ~10.5 GB | **6.0 GB** |

Being smaller is the point: the 14B could not hold a 16k KV cache and its own weights on a 12 GB
card, so Ollama silently ran six layers on the CPU.

### Two settings measured rather than assumed

**Reasoning is off.** On the 14B it was catastrophic — 10/12 in 936s against 11/12 in 102s. On the 9B
it is merely not worth it: both reach 12/12, but reasoning takes 207s against 91s. `EVAL_THINK=1`
re-tests it.

**Context is 8k, not 16k, despite 16k fitting.** Raising it dropped the eval to 11/12, reproducibly
across three runs, with Grover collapsing from 100% to 25% on the marked state. A bigger window
appears to let retrieval supply more material than the model attends to well. Fitting was never a
reason to use it.

### Tool schemas are advisory, not enforced

The circuit schema has an enum of legal gate names and the model ignored it, asking for `CZ` — which
this palette spells as `Z` with a control. Constrained decoding shapes output; it does not guarantee
it. **The validator is what makes model output safe.** That finding drove its forgiveness: it expands
the aliases every model reaches for, fans a one-qubit gate given several wires into one gate per wire,
and accepts a symmetric gate written as controls with no target.

### A test that was lying

`grover` failed for a long time, and chasing it turned up something worse than the failure.

The model wrote the controlled-Z **once per wire**, following the per-wire pattern of the surrounding
layers. A controlled-Z is symmetric, so that is the same gate twice — it cancels, and the oracle
silently disappears. Not a knowledge gap: asked directly, the model explains that a controlled-Z is
symmetric; it simply misremembers the shape when recalling it unaided.

But the check was only "does it reach `|11⟩`?", and `H,H | X,X | Z,Z | X,X | H,H` reaches `|11⟩` with
certainty while containing **no controlled gate at all**. That circuit passed. So "grover passed"
never established that Grover had been built.

Both are fixed — the case now also requires a controlled gate and a superposition to search over, and
the prompt carries a worked Grover with the controlled-Z layer called out. The lesson generalises:
scoring a circuit by its output alone tests the destination, not the journey. That same bug is now a
learner-facing exercise.

---

## Future work

**Sandboxing.** `pyserver` has a timeout, a memory cap and a CPU cap, but no filesystem or network
isolation. `bubblewrap` would give real isolation for a few extra flags on the existing subprocess
call — and applied to *both* paths it would also make it safe to let the tutor run and verify code
before suggesting it, which is the one thing it currently cannot do.

**More exercises.** Only 6 of the 22 steps have one. The machinery is built; the rest is authoring.

**More Python lessons.** The transpiler, primitives, parametrised circuits, and QFT in code.

**More content.** Error correction and noise, then variational methods (VQE, QAOA). The curriculum is
complete for its stated scope, so this is extending it rather than filling gaps.

**More interactive widgets.** Only 4 appear across 22 lessons; the Bloch sphere shows up exactly once
outside its own page.

**Typography.** Body text on topic pages runs ~1090px at 15px — roughly 150 characters per line,
against a usual target of 65–75. Fixing it means capping prose width while letting circuits and
KaTeX blocks stay wide.

**Real hardware.** Circuits built here already export as Qiskit; sending one to IBM Quantum and
comparing the result with the simulator would be a natural final lesson.

---

## Security

**Submitted Python is sandboxed.** Every run goes into bubblewrap: read-only system, private scratch
directory, no network, no view of your home. Writes outside the scratch land in an ephemeral root and
vanish. Verified rather than assumed — a probe submitted through the service reports:

```
/home/<you>/.bashrc      False      /etc/passwd   False
/home/<you>/.ssh/id_rsa  False      network       blocked
```

The sandbox is **required by default**: if bubblewrap is missing the service refuses to run code and
says why, instead of silently falling back. `PY_SANDBOX=off` opts out deliberately, and the startup
banner, `/health` and the page all report it.

**Only the site may submit.** `/run` rejects POSTs whose `Origin` is not allowlisted, which stops a
malicious page you happen to be visiting from driving the service through your browser. It is not
access control — anyone with tunnel access can send what they like, and the sandbox is what protects
you there.

Both services bind to `127.0.0.1`. Share the site over a tunnel; never expose 8000 or 11434.

**The tutor cannot execute anything.** It reads your code and suggests fixes; running them is your
click. A test asserts no execution tool exists.

Resource limits — timeout, address-space cap, CPU cap — still apply inside the sandbox, and stop a
program wasting the machine rather than misusing it.
