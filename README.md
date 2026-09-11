# Quantum Learning

An interactive site for learning quantum computing: maths foundations, theory, and a working
circuit simulator.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 154 tests
npm run build
```

## Status

| Area | State |
| --- | --- |
| Simulator core | Complete, fully tested |
| Circuit Lab (`/circuit`) | Complete and working |
| Maths track (`/math`) | Structure complete, **content is placeholder** |
| Theory track (`/theory`) | Structure complete, **content is placeholder** |
| Algorithms (`/algorithms`) | Placeholder shell only — awaiting spec |

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

## Tests

`npm test` runs 154 tests: the simulator against known results (Bell and GHZ states, the full
Toffoli truth table, CNOT in both wire directions to catch bit-order bugs, norm preservation,
reduced density matrices, seeded sampling, non-adjacent SWAP and Fredkin, the six input presets
against their Bloch positions), the circuit editing rules, and page-level tests that drive the real
drag-and-drop and the input picker.
