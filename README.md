# Quantum Learning

An interactive site for learning quantum computing: maths foundations, theory, and a working
circuit simulator.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 299 tests
npm run eval       # scores the tutor against a live Ollama
npm run build
```

## Status

| Area | State |
| --- | --- |
| Simulator core | Complete, fully tested |
| Circuit Lab (`/circuit`) | Complete and working |
| Maths track (`/math`) | Structure complete, **content is placeholder** |
| Theory track (`/theory`) | Structure complete, **content is placeholder** |
| Algorithms (`/algorithms`) | Complete — 12 algorithms, each with a runnable circuit |
| Tutor (local LLM) | Complete — needs Ollama running |

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

Its four tools are read-only or validated. None writes a file, runs code, or makes a network call, so
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

### On reading the score

The set currently passes **12/12**, reproducibly. That is not a guarantee of correctness — twelve
cases is a smoke test, and the text half of it only checks that expected words appear.

What it does establish is that the circuits are right, because those cases are scored by running
the generated circuit through the simulator. And a failure would mean the model built the wrong
circuit, not that a wrong circuit reaches a reader: the panel always displays what the simulator
computed, so a mistake shows up as a diagram that visibly does something else.

## Tests

`npm test` runs 299 tests: the simulator against known results (Bell and GHZ states, the full
Toffoli truth table, CNOT in both wire directions to catch bit-order bugs, norm preservation,
reduced density matrices, seeded sampling, non-adjacent SWAP and Fredkin, the six input presets
against their Bloch positions), the circuit editing rules, and page-level tests that drive the real
drag-and-drop and the input picker.

The tutor adds its own: the validator against malformed and hostile model output, retrieval against
known queries, tool dispatch, stream parsing, and the whole panel — tool loop included — driven by a
scripted fake model rather than a live one.
