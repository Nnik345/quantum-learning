# Quantum Learning

An interactive site for learning quantum computing: maths foundations, theory, and a working
circuit simulator.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 376 tests
npm run eval       # scores the tutor against a live Ollama
npm run build
```

## The learning path

The front page is a guided route through all 22 topics rather than three parallel tracks. Maths and
theory are interleaved with the algorithms that consume them, so the first real algorithm arrives at
step 9 instead of after all the theory.

| Stage | Steps | |
| --- | --- | --- |
| Foundations | 1-3 | Complex Numbers, Vectors & Matrices, Eigenvalues & Eigenvectors |
| One Qubit | 4-9 | Dirac, Bloch Sphere, Gates, Probability, Measurement, **Quantum Random Numbers** |
| Many Qubits | 10-14 | Tensor Products, Entanglement, **Bell, Superdense, Teleportation** |
| Oracles | 15-18 | **Deutsch, Deutsch-Jozsa, Bernstein-Vazirani, Simon** |
| Amplitude & Phase | 19-21 | **Grover, QFT, Phase Estimation** |
| Synthesis | 22 | **Shor** |

`src/content/path.ts` is the only place order is written down. Step numbers, progress totals,
prev/next links and the whole front page derive from it, so reordering a stage is moving a line. A
test asserts every topic in `TRACKS` appears exactly once - add a topic and forget to place it, and
the build fails rather than a reader silently never seeing it.

**Prerequisites are derived, not declared.** A topic's prerequisites are simply the topics before it.
A hand-written dependency graph would be more precise, but it is a second ordering that can drift
from this one with nothing to catch it.

**Nothing is locked.** Landing on a topic whose groundwork you have not read shows a notice naming
the nearest few, and the content renders underneath it regardless. Locking would obstruct anyone
with prior knowledge - and since progress lives in `localStorage`, clearing site data would lock a
returning reader out of everything they had already read.

**Progress is two things.** Visiting a topic is recorded automatically so the path shows signs of
life immediately; completion needs the button at the foot of the page, so "done" keeps meaning
something rather than "glanced at". Both live in `localStorage` under
`quantum-learning:progress:v1`, and unknown slugs are dropped on read so a renamed topic can never
mark a real step complete.

## Status

| Area | State |
| --- | --- |
| Simulator core | Complete, fully tested |
| Circuit Lab (`/circuit`) | Complete and working |
| Maths track (`/math`) | Structure complete, **content is placeholder** |
| Theory track (`/theory`) | Structure complete, **content is placeholder** |
| Algorithms (`/algorithms`) | Complete — 12 algorithms, each with a runnable circuit |
| Tutor (local LLM) | Complete — needs Ollama running |
| Learning path | Complete — 22 guided steps, progress tracked locally |

## Conventions

**Qubit ordering.** `q0` is the top wire of a circuit and the **leftmost** symbol in a ket:
`|q0 q1 q2⟩`. Internally qubit `q` occupies bit `n - 1 - q` of the basis index. This is textbook
(Nielsen & Chuang) ordering and is the **reverse of Qiskit**, which prints `q0` last. If you compare
output against Qiskit, the bitstrings will look mirrored.

**Measurement.** A pure state-vector simulator cannot represent a post-measurement mixed state, so
the two honest views are kept separate:

- The State / Probabilities / Bloch panels show the exact **pre-measurement** state, with
  measurement gates treated as no-ops. The UI says so whenever a measurement is present.
- The Shots panel runs the circuit per-shot with a seeded RNG, collapsing at each measurement gate.
  That is the correct answer for circuits with mid-circuit measurement.

## Writing content

All Maths and Theory content is plain data. There is no JSX to edit and nothing to register by hand
— the index pages, sidebars, anchors and prev/next links are all derived from these files.

- `src/content/math.ts` — the Maths topics
- `src/content/theory.ts` — the Theory topics
- `src/content/registry.ts` — track order and titles
- `src/content/types.ts` — the block vocabulary

A topic is an object with an ordered `sections` array. **Reorder** by moving a line, **add** by
adding an object, **delete** by removing one. A section with no `blocks` renders as a visibly-marked
placeholder.

```ts
{
  id: 'polar-form',              // URL anchor — keep stable once shared
  title: 'Polar Form',
  summary: 'One line, shown under the heading.',
  blocks: [
    { kind: 'text', text: 'Prose with $inline$ LaTeX and **bold**.' },
    { kind: 'math', tex: 'z = re^{i\\theta}', caption: 'Optional caption.' },
    { kind: 'list', items: ['Point one', 'Point two'], ordered: false },
    { kind: 'callout', tone: 'tip', title: 'Note', text: 'A highlighted aside.' },
    { kind: 'widget', widget: 'bloch-sphere', caption: 'Optional caption.' },
  ],
}
```

Available widget keys are in `src/content/widgets.tsx`: `bloch-sphere`, `argand-plane`,
`matrix-playground`, `circuit-teaser`. Add a new one by writing the component and adding it to the
`WIDGETS` map — it is then usable from any section.

`complex-numbers` and `dirac-notation` each have one worked section demonstrating every block type.
They are examples, not commitments — rewrite or delete them.

## Layout

```
src/
  lib/quantum/     Simulator core — pure TypeScript, no React
    complex.ts     Complex arithmetic
    matrix.ts      Matrix ops + the U†U = I unitarity check
    state.ts       State vector, applyGate, partial trace, Bloch vectors
    gates.ts       Built-in gate library
    circuit.ts     Circuit model and placement rules
    simulate.ts    Analytic run + shot sampling
    parseComplex.ts  "1/sqrt(2)", "e^(i*pi/4)" → Complex
    persist.ts     Save/load, with custom gates re-validated on load
  circuit/         The Circuit Lab UI
  content/         Topic data + embeddable widgets
  components/      Tex, BlochSphere, layout
  routes/          Page components
```

Every gate — X, CNOT, Toffoli, SWAP, a controlled custom gate — goes through the single
`applyGate(state, matrix, targets, controls)` function. There are no per-gate special cases.

## Circuit Lab

Drag gates from the palette onto the wires. Drag a placed gate to move it, or off the grid to delete
it. Select a gate to set its angle, reassign its wires, or add controls.

**Qubit inputs.** Each wire starts in a state of your choosing, set by clicking the ket button in the
wire's gutter. Presets cover the six cardinal states — |0⟩, |1⟩, |+⟩, |−⟩, |i⟩, |−i⟩ — or enter a
custom α and β directly (`sqrt(0.36)`, `e^(i*pi/3)/sqrt(2)`, …). A custom state must satisfy
|α|² + |β|² = 1; if it doesn't, it is refused with a Normalise button rather than being silently
rescaled. Inputs are per-wire, so the starting register is always a product state — an entangled
input cannot be expressed by a per-wire control.

**Non-adjacent multi-qubit gates.** SWAP and two-qubit custom gates are not restricted to
neighbouring wires. They drop onto adjacent wires by default; move either end to any wire from the
inspector. The wires a gate's link crosses are reserved in that column, as in standard notation, so
nothing can be placed underneath it.

- Keyboard: `Delete` removes the selection, `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo, `←` / `→` step
  through the circuit, `Esc` deselects.
- Click a column number to inspect the state at that point.
- Per-qubit Bloch spheres come from the reduced density matrix, so an entangled qubit's arrow
  visibly shrinks toward the centre. Build a Bell state and watch both collapse to the origin.
- Custom gates are entered as a matrix. Expressions like `1/sqrt(2)`, `e^(i*pi/4)`, `(1+i)/2` and
  `-i` are accepted, and the result must pass `U†U = I` before it can be saved.
- The circuit autosaves to `localStorage`, and can be exported and imported as JSON.

Not built: OpenQASM / Qiskit / image export. The serialiser in `circuit.ts` is kept standalone so
these can be added without touching the UI.

## The tutor

A floating panel on every page, answering questions against a **local** model — nothing leaves the
machine. It retrieves from the site's own lessons, builds circuits, reads whatever is on your board,
and runs the simulator to check itself.

### Setup

```
sudo pacman -S ollama-cuda
sudo systemctl enable --now ollama
ollama pull qwen3.5:9b           # ~6.6 GB, lands in /var/lib/ollama
```

Optionally, `sudo systemctl edit ollama`:

```
[Service]
Environment="OLLAMA_KEEP_ALIVE=30m"
Environment="OLLAMA_NUM_PARALLEL=1"
```

Check `ollama ps` reports **100% GPU**. Any CPU percentage means the model spilled out of VRAM and
generation will be several times slower — but on a 12 GB card this model has room to spare, sitting
at 5.7 GB resident.

`OLLAMA_MODEL` and `OLLAMA_NUM_CTX` override the defaults, so a different model can be scored
against the eval set without touching code.

Running the site on another machine? Tunnel, and change nothing:

```
ssh -L 11434:localhost:11434 user@gpu-box
```

The browser only ever talks to `/ollama`, which Vite proxies to `localhost:11434` — same-origin, so
there is no CORS to configure. `OLLAMA_URL` overrides the target.

### The design rule

**The model proposes; the code decides.** Nothing it says about a circuit is shown as fact. Every
proposal goes through `checkPlacement`, gets simulated, and the panel displays the *computed* result.
If the model claims a Bell state and the simulation disagrees, the simulation is what you see.
`deserialiseCircuit` already did this job for corrupt files — model output is the same trust category.

**It can see the page you are on.** `get_current_page` returns the lesson text plus every worked
circuit printed on it — each preset's id, its gates, and what it actually produces — so "explain
this circuit" works on a lesson page and not only in the Lab. `run_simulation` takes a preset id, so
exact numbers for a page's circuit are computed rather than read off the diagram.

**The site is the ground truth, not the model's memory.** `search_content` scores whole topics by
term overlap, IDF and verbatim headings; `open_topic` fetches a page by name when the name is already
known; and `get_reference_circuit` returns one of the twelve tested circuits — its gates, what it
really produces, and the page it is printed on. Called blind it lists all twelve, so the model can
find out what exists rather than needing to be told.

That last tool exists because of a specific failure. Asked for Grover, the model wrote the
controlled-Z once per wire, which is the *same gate twice* — it cancels, the marking silently
vanishes, and the search does nothing, while a verified Grover sat in `ALGORITHM_PRESETS` the whole
time. `propose_circuit` now takes an optional `compareTo` naming the reference being implemented, and
reports the difference:

```
ACCEPTED: 2 qubits, 4 gates.
DIFFERS from the verified "grover" circuit, which produces -1|11⟩ (11 100.0%).
Yours produces 0.5|00⟩ + 0.5|01⟩ + 0.5|10⟩ + 0.5|11⟩.
Call get_reference_circuit to see its gates, then fix yours.
```

Deliberately explicit rather than inferred: guessing which reference the reader *meant* and appending
an unasked-for diff produces confusing contradictions when the guess is wrong.

**Citations are links, and only ever to this site.** Tool results name the page they came from, and
the prompt asks for it back as a markdown link. `src/assistant/links.ts` then resolves every href
against the real routes — `/`, `/reference`, `/circuit`, and any `/{trackId}/{slug}` that exists — and
anything else renders as plain text, keeping its label so no words are lost. External URLs,
`javascript:`, protocol-relative paths and plausible-but-wrong internal paths all fail closed. Model
output is untrusted, and a citation feature is not worth making the page a launchpad for arbitrary
URLs.

Its seven tools are read-only or validated. None writes a file, runs code, or makes a network call, so
a hostile question can do no worse than draw a silly circuit.

Reasoning is on for circuit building, hidden behind a "show reasoning" toggle, and off for ordinary
conversation where a twenty-second pause is not worth it.

### Why the ordering guard exists

Qwen's training data is overwhelmingly Qiskit-flavoured, and Qiskit puts q0 **last**. Three layers
push back: the convention is in the system prompt, tool results always report bitstrings through our
own `basisLabel`, and an eval case fails outright if "q0 is |1⟩" comes back as `001`.

### Evaluating it

```
npm run eval            # every case
npm run eval bell       # just matching ids
```

Temperature 0 and a fixed seed, so two runs are comparable. **Circuit cases are scored by running the
generated circuit** — a pass means the physics is right, not that the prose sounded convincing. Text
cases only check that expected words appear, which is a grounding smoke test and nothing more; the
harness says exactly that in its own output.

`npm test` never needs Ollama.

### Choosing the model

The eval picked it. Qwen3-14B was the original choice; Qwen3.5-9B was tried because it is a newer
generation at two-thirds the size, and it won outright on the same twelve cases:

| | qwen3:14b | qwen3.5:9b |
| --- | --- | --- |
| Eval score | 11/12 | **12/12** |
| Wall time | 130s | **90s** |
| Throughput | 28 tok/s | **~50 tok/s** |
| GPU residency | 40/41 layers | **100%** |
| Resident size | ~10.5 GB | **6.0 GB** |
| VRAM headroom | none (spilled at 16k) | **4.2 GB spare** |

Being smaller is the point: the 14B could not hold a 16k KV cache and its own weights on a 12 GB
card, so Ollama silently ran six layers on the CPU. The 9B fits whole, and being a newer generation
it is also simply better at the task — it was the only model to pass `bell` and `grover` in the same
run, which the 14B never managed at any setting.

### Two settings that were measured rather than assumed

**Reasoning is off.** On Qwen3-14B it was catastrophic — 10/12 in 936s against 11/12 in 102s, with
Grover never finishing at all. On Qwen3.5-9B it is merely not worth it: both configurations reach
12/12, but reasoning takes 207s against 91s. Off by default; `EVAL_THINK=1` re-tests it.

**Context is 8k, not 16k, despite 16k fitting.** The 9B has the VRAM for a 16k window on a 12 GB
card. Raising it dropped the eval from 12/12 to 11/12, reproducibly across three runs, with Grover
collapsing from 100% to 25% on the marked state; putting it back restored 12/12. A bigger window
appears to let retrieval supply more material than the model attends to well. Fitting was never a
reason to use it.

### What the eval actually found

Two results worth keeping, both of which contradicted an assumption:

**Tool-parameter schemas are advisory, not enforced.** The circuit schema has an enum of legal gate
names and the model ignored it repeatedly, asking for `CZ` — which this palette spells as `Z` with a
control. Constrained decoding shapes the output; it does not guarantee it. The validator is what
actually makes model output safe, which is why every circuit still goes through `checkPlacement` and
gets simulated before anything is displayed.

That finding drove the validator's forgiveness: it now expands the aliases every model reaches for
(`CNOT`, `CZ`, `CCX`, `Toffoli`, `Fredkin`, …), fans a one-qubit gate given several wires out into
one gate per wire, and accepts a symmetric gate written as controls with no target. Each of those
was a real failure that cost a whole retry round.

### A caught false negative

The `ordering-question` case originally rejected any answer containing "rightmost". A correct,
well-sourced answer failed it — the model said q0 is leftmost here **and** that Qiskit puts it
rightmost, which is exactly the contrast the site's own page draws. The case now requires q0 to be
tied to "leftmost" rather than banning a word.

Worth keeping as a reminder of what keyword scoring can and cannot do: it caught nothing real there,
and only the circuit cases, scored by simulation, prove anything.

### The Grover case, and a test that was lying

`grover` failed for a long time, and chasing it turned up a worse problem than the failure.

**The model's mistake.** Grover's circuit is a stack of layers where nearly every layer has one gate
*per wire* — `H,H`, `X,X`, `H,H`. The exception is the controlled-Z, which is a single gate spanning
both wires. The model applied the per-wire pattern uniformly and wrote the controlled-Z once for
each wire. Since a controlled-Z is symmetric, that is the same gate twice, which cancels — the
oracle silently disappeared and the search stopped searching.

It is not a knowledge gap. Asked directly, the model explains correctly that a controlled-Z is
symmetric; given the layer structure explicitly, it builds a flawless Grover. It simply misremembers
the shape when recalling it unaided.

**The test could not tell Grover from a lookalike.** The check was only "does it reach |11⟩?", and

    H,H | X,X | Z,Z | X,X | H,H

reaches |11⟩ with certainty while containing no controlled gate at all — nothing marks anything, so
no search happens. That circuit passed. Which means "grover passed" never established that Grover
had been built, and an earlier 12/12 reported here rested on a check that admitted fakes.

Both are fixed. The case now also requires at least one controlled gate and a superposition to
search over, so a lookalike fails on structure regardless of where it lands; and the system prompt
carries a worked Grover, with the controlled-Z layer called out explicitly. The model now produces
a genuine search — `|11⟩ 100.0% via 2 controlled gate(s)` — reproducibly.

The lesson generalises past this one case: scoring a circuit by its output alone tests the
destination, not the journey. Where structure is what makes an algorithm that algorithm, the check
has to look at the structure. That is not a guarantee of correctness — twelve
cases is a smoke test, and the text half of it only checks that expected words appear.

Twelve cases is a smoke test, and the text half only checks that expected words appear. What it does
establish is whether the circuits are right — those cases are scored by running the generated circuit
through the simulator, and where the structure is what makes an algorithm that algorithm, by checking
the structure too.

## Tests

`npm test` runs 376 tests: the simulator against known results (Bell and GHZ states, the full
Toffoli truth table, CNOT in both wire directions to catch bit-order bugs, norm preservation,
reduced density matrices, seeded sampling, non-adjacent SWAP and Fredkin, the six input presets
against their Bloch positions), the circuit editing rules, and page-level tests that drive the real
drag-and-drop and the input picker.

The tutor adds its own: the validator against malformed and hostile model output, retrieval against
known queries, reference lookup for all twelve circuits, link rendering against hostile hrefs, tool
dispatch, stream parsing, and the whole panel — tool loop included — driven by a
scripted fake model rather than a live one.
