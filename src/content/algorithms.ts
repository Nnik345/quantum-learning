/**
 * ALGORITHMS TRACK.
 *
 * Ordered so that each algorithm introduces exactly one new mechanism and depends only on what
 * came before. Tier 1 needs no oracle at all; tier 2 introduces the oracle and phase kickback;
 * tier 3 introduces amplitude amplification and the Fourier/phase machinery; tier 4 combines them.
 *
 * Every `circuit` block names a preset from lib/quantum/presets.ts, each of which is verified
 * against its textbook result in presets.test.ts — the diagrams and the claims around them are
 * checked, not asserted.
 */

import type { Topic } from './types'

// ---------------------------------------------------------------------------
// Tier 1 — protocols: what entanglement buys you
// ---------------------------------------------------------------------------

const qrng: Topic = {
  slug: 'quantum-random-numbers',
  title: 'Quantum Random Numbers',
  blurb: 'The smallest real quantum algorithm: one gate, one measurement, one genuinely random bit.',
  estMinutes: 10,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      summary: 'Classical computers cannot actually produce randomness.',
      blocks: [
        {
          kind: 'text',
          text: 'Every classical random number generator is a deterministic function of a hidden seed. Given the seed and the algorithm, the entire sequence is predictable — `rand()` only *looks* random because you are not shown the state.',
        },
        {
          kind: 'text',
          text: 'Quantum measurement is different in kind. The Born rule says the outcome is not determined by anything at all until you measure. There is no seed to discover.',
        },
      ],
    },
    {
      id: 'idea',
      title: 'One Gate Is the Whole Algorithm',
      blocks: [
        {
          kind: 'text',
          text: 'Start in $|0\\rangle$ and apply a single Hadamard. That puts the qubit in an even superposition:',
        },
        { kind: 'math', tex: 'H|0\\rangle = \\tfrac{1}{\\sqrt2}\\big(|0\\rangle + |1\\rangle\\big) = |+\\rangle' },
        {
          kind: 'text',
          text: 'Both amplitudes have magnitude $1/\\sqrt2$, so both outcomes have probability $|1/\\sqrt2|^2 = 1/2$. Measure, and you get one fair bit.',
        },
        { kind: 'circuit', preset: 'qrng' },
        {
          kind: 'text',
          text: 'Open it in the Circuit Lab and run a few thousand shots. You will get close to 50/50, but never exactly — that wobble is **shot noise**, and it is what real quantum hardware returns too.',
        },
      ],
    },
    {
      id: 'honesty',
      title: 'What This Does and Does Not Give You',
      blocks: [
        {
          kind: 'callout',
          tone: 'warn',
          title: 'Randomness is not the same as security',
          text: 'The physics guarantees the outcome is unpredictable **given a perfect device**. It says nothing about whether your actual hardware is biased, miscalibrated, or compromised. Real quantum RNGs need extraction and verification on top.',
        },
        {
          kind: 'text',
          text: 'It is also worth being clear that this is not a *speedup*. Nothing here is faster than a classical computer. It is a different guarantee, not a better running time — which makes it a useful first example precisely because there is no complexity argument to distract from the mechanism.',
        },
      ],
    },
  ],
}

const bellStates: Topic = {
  slug: 'bell-states',
  title: 'Bell States',
  blurb: 'Two gates produce a correlation with no classical explanation — the resource everything later depends on.',
  estMinutes: 20,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'We want two qubits whose measurement results are perfectly correlated, while neither qubit on its own has a definite state. Classically that is contradictory: if the pair always agrees, each must already "know" its answer.',
        },
      ],
    },
    {
      id: 'construction',
      title: 'H, Then CNOT',
      blocks: [
        {
          kind: 'text',
          text: 'Put the first qubit in superposition, then use it to control a NOT on the second:',
        },
        {
          kind: 'math',
          tex: '|00\\rangle \\xrightarrow{\;H \\otimes I\;} \\tfrac{1}{\\sqrt2}(|00\\rangle + |10\\rangle) \\xrightarrow{\;\\mathrm{CNOT}\;} \\tfrac{1}{\\sqrt2}(|00\\rangle + |11\\rangle)',
        },
        {
          kind: 'text',
          text: 'The CNOT did not *choose* a branch. It acted on both terms of the superposition at once, flipping the second qubit only in the term where the first was $|1\\rangle$. The result cannot be written as any product $|a\\rangle \\otimes |b\\rangle$ — that is the definition of **entangled**.',
        },
        { kind: 'circuit', preset: 'bell' },
      ],
    },
    {
      id: 'seeing-it',
      title: 'Seeing the Entanglement',
      summary: 'The Bloch arrows collapse to the origin.',
      blocks: [
        {
          kind: 'text',
          text: 'Open the circuit above and switch to the **Bloch** tab. Both arrows sit at the centre of their spheres, with $|r| = 0$.',
        },
        {
          kind: 'text',
          text: 'That is not a rendering quirk. A point on the surface represents a definite pure state; the centre represents *maximum ignorance*. Each qubit of a Bell pair, considered alone, genuinely has no state of its own — all the information lives in the correlation. Step back one column and watch both arrows jump back out to the surface.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Why there is no two-qubit Bloch sphere',
          text: 'The sphere describes one qubit. Entanglement is information that is not held by either qubit separately, so no pair of spheres can represent it — which is exactly why the arrows shrink instead.',
        },
      ],
    },
    {
      id: 'four-states',
      title: 'The Four Bell States',
      blocks: [
        {
          kind: 'text',
          text: 'Changing the input gives four maximally entangled states, and they form a basis for two qubits:',
        },
        {
          kind: 'math',
          tex: '\\begin{aligned} |\\Phi^{+}\\rangle &= \\tfrac{1}{\\sqrt2}(|00\\rangle + |11\\rangle) & |\\Phi^{-}\\rangle &= \\tfrac{1}{\\sqrt2}(|00\\rangle - |11\\rangle) \\\\ |\\Psi^{+}\\rangle &= \\tfrac{1}{\\sqrt2}(|01\\rangle + |10\\rangle) & |\\Psi^{-}\\rangle &= \\tfrac{1}{\\sqrt2}(|01\\rangle - |10\\rangle) \\end{aligned}',
        },
        {
          kind: 'text',
          text: 'Try it: in the Circuit Lab, click the input button on a wire and set it to $|1\\rangle$. Starting from $|10\\rangle$ gives $|\\Psi^{+}\\rangle$; from $|11\\rangle$ you get $|\\Psi^{-}\\rangle$.',
        },
      ],
    },
  ],
}

const superdense: Topic = {
  slug: 'superdense-coding',
  title: 'Superdense Coding',
  blurb: 'Send two classical bits by transmitting one qubit — if you shared entanglement first.',
  estMinutes: 20,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'Alice wants to send Bob two classical bits, but she may transmit only a single qubit. A qubit has two complex amplitudes, so it seems like it should hold plenty — but measuring one qubit yields exactly one bit. On its own, one qubit carries one bit.',
        },
        {
          kind: 'text',
          text: 'The way around this is to set something up **in advance**.',
        },
      ],
    },
    {
      id: 'protocol',
      title: 'The Protocol',
      blocks: [
        {
          kind: 'list',
          ordered: true,
          items: [
            'Ahead of time, Alice and Bob share a Bell pair — she holds one qubit, he holds the other.',
            'Alice applies one of four gates to **her** qubit, chosen by the two bits she wants to send: $I$ for 00, $X$ for 01, $Z$ for 10, $ZX$ for 11.',
            'She sends her single qubit to Bob.',
            'Bob now holds both, undoes the Bell preparation with a CNOT and an $H$, and measures. He reads both bits exactly.',
          ],
        },
        {
          kind: 'text',
          text: 'The four gates map the one Bell state onto the four *different* Bell states. Because those four are mutually orthogonal, Bob can distinguish them perfectly — no guessing.',
        },
        { kind: 'circuit', preset: 'superdense', caption: 'Encoding 01 with an $X$. Swap that gate for $I$, $Z$, or $Z$ then $X$ to send the other three messages.' },
      ],
    },
    {
      id: 'catch',
      title: 'Where the Second Bit Actually Came From',
      blocks: [
        {
          kind: 'callout',
          tone: 'warn',
          title: 'This does not beat the classical limit',
          text: 'Two qubits moved in total — Bob’s half travelled to him earlier, during setup. Counting honestly, two qubits carried two bits. Superdense coding lets you *defer* half the cost to a quiet moment, not avoid it.',
        },
        {
          kind: 'text',
          text: 'This is a good habit to build early: when a quantum protocol looks like it beats an information-theoretic bound, find the resource that was consumed elsewhere. Here it is the pre-shared entanglement, which is destroyed by the protocol and must be re-established for the next message.',
        },
      ],
    },
  ],
}

const teleportation: Topic = {
  slug: 'quantum-teleportation',
  title: 'Quantum Teleportation',
  blurb: 'Move an unknown quantum state to a distant qubit using entanglement and two classical bits.',
  estMinutes: 25,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'Alice holds a qubit in some unknown state $|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$ and wants Bob to have it. She cannot measure it — that would collapse it and destroy the very amplitudes she is trying to send. She cannot copy it either.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'The no-cloning theorem',
          text: 'No unitary can map $|\\psi\\rangle|0\\rangle$ to $|\\psi\\rangle|\\psi\\rangle$ for every $|\\psi\\rangle$. Gates are linear, and copying is not a linear operation. So "just duplicate it" is off the table.',
        },
      ],
    },
    {
      id: 'protocol',
      title: 'The Protocol',
      blocks: [
        {
          kind: 'list',
          ordered: true,
          items: [
            'Alice and Bob pre-share a Bell pair.',
            'Alice performs a **Bell measurement** on her unknown qubit together with her half of the pair — a CNOT followed by an $H$, then measure both.',
            'She sends Bob the two classical bits she got.',
            'Bob applies a correction to his qubit — $X$ if the first bit was 1, $Z$ if the second was — and now holds $|\\psi\\rangle$ exactly.',
          ],
        },
        {
          kind: 'text',
          text: 'Alice’s measurement gives her two completely random bits that reveal nothing about $\\alpha$ and $\\beta$. Yet those two bits are precisely what Bob needs, because the measurement has already projected his qubit into one of four states, each a known rotation away from $|\\psi\\rangle$.',
        },
        { kind: 'circuit', preset: 'teleportation', caption: 'q0 starts in $|i\\rangle$ and ends up on q2. Check the **Bloch** tab: q2’s arrow finishes where q0’s began.' },
      ],
    },
    {
      id: 'deferred',
      title: 'A Note on This Circuit',
      blocks: [
        {
          kind: 'callout',
          tone: 'note',
          title: 'Quantum controls stand in for classical ones',
          text: 'A real implementation measures Alice’s qubits and applies Bob’s corrections **conditioned on the classical results**. This simulator has no classical feedforward, so the corrections are drawn as quantum controls instead. By the *principle of deferred measurement* the two give identical results, which is why the circuit is still correct — but on hardware the middle of this circuit is classical.',
        },
      ],
    },
    {
      id: 'limits',
      title: 'What Was and Was Not Transported',
      blocks: [
        {
          kind: 'text',
          text: 'The state moved; no matter did. And Alice’s original is gone — after her measurement her qubit is in a definite computational-basis state, holding none of the original amplitudes. Teleportation *moves* rather than *copies*, which is exactly what no-cloning demands.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'No faster-than-light anything',
          text: 'Bob’s qubit is useless until he receives Alice’s two classical bits, and those travel no faster than light. Before they arrive his qubit is maximally mixed — he cannot tell anything has happened.',
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Tier 2 — oracles and query complexity
// ---------------------------------------------------------------------------

const deutsch: Topic = {
  slug: 'deutsch',
  title: 'Deutsch’s Algorithm',
  blurb: 'The first algorithm to beat every classical method — by exactly one query.',
  estMinutes: 25,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'You are given a black box computing a one-bit function $f: \\{0,1\\} \\to \\{0,1\\}$, and promised it is either **constant** ($f(0) = f(1)$) or **balanced** ($f(0) \\neq f(1)$). Which is it?',
        },
        {
          kind: 'text',
          text: 'Classically you must evaluate $f$ twice. One value tells you nothing — you need both to compare them. Deutsch’s algorithm answers in **one** query.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'What an oracle is',
          text: 'The box is a unitary $U_f: |x\\rangle|y\\rangle \\to |x\\rangle|y \\oplus f(x)\\rangle$. Writing the answer into a second register with XOR keeps it reversible, which every quantum gate must be. We count how many times $U_f$ is used, not what is inside it.',
        },
      ],
    },
    {
      id: 'kickback',
      title: 'Phase Kickback',
      summary: 'The trick that makes the whole family of oracle algorithms work.',
      blocks: [
        {
          kind: 'text',
          text: 'Set the answer register to $|-\\rangle = (|0\\rangle - |1\\rangle)/\\sqrt2$ instead of $|0\\rangle$. Then XORing $f(x)$ into it does something surprising — it leaves the register alone and puts a **sign on the input**:',
        },
        { kind: 'math', tex: 'U_f\\,|x\\rangle|-\\rangle = (-1)^{f(x)}\\,|x\\rangle|-\\rangle' },
        {
          kind: 'text',
          text: 'Check it by hand. If $f(x) = 0$ nothing changes. If $f(x) = 1$ the two halves of $|-\\rangle$ swap, which turns $(|0\\rangle - |1\\rangle)$ into $(|1\\rangle - |0\\rangle) = -(|0\\rangle - |1\\rangle)$. The minus sign has nowhere to live except out front.',
        },
        {
          kind: 'text',
          text: 'Now run the input register in superposition. One query stamps $(-1)^{f(x)}$ onto *every* $x$ at once, and a final Hadamard turns the difference between those signs into a difference in amplitude that measurement can see.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'The Circuit',
      blocks: [
        {
          kind: 'text',
          text: 'Hadamard both wires, query the oracle once, Hadamard the input again, and measure it. The result is $f(0) \\oplus f(1)$: **0 means constant, 1 means balanced**.',
        },
        { kind: 'circuit', preset: 'deutsch', caption: 'The oracle here is the CNOT, implementing $f(x) = x$ — balanced, so the result is 1. Note q1 starts in $|1\\rangle$ so that $H$ makes $|-\\rangle$.' },
        {
          kind: 'text',
          text: 'Delete the CNOT in the Circuit Lab and $f$ becomes the constant zero function; the measurement flips to 0. That one gate is the entire difference the algorithm detects.',
        },
      ],
    },
    {
      id: 'meaning',
      title: 'What the Speedup Really Is',
      blocks: [
        {
          kind: 'text',
          text: 'Two queries down to one is not impressive on its own. What matters is *why* it worked: the algorithm never learned $f(0)$ or $f(1)$ individually. It extracted a **global property** — a relationship between them — that no single classical evaluation can see.',
        },
        {
          kind: 'text',
          text: 'Every algorithm in the next few pages is a variation on that theme, and the saving grows from one query to exponentially many.',
        },
      ],
    },
  ],
}

const deutschJozsa: Topic = {
  slug: 'deutsch-jozsa',
  title: 'Deutsch–Jozsa',
  blurb: 'The same trick on n bits, turning one query into an exponential separation.',
  estMinutes: 25,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'Now $f: \\{0,1\\}^n \\to \\{0,1\\}$, promised to be either constant, or balanced in the strong sense that it returns 0 on exactly half the inputs and 1 on the other half.',
        },
        {
          kind: 'text',
          text: 'A deterministic classical algorithm may need $2^{n-1} + 1$ queries: you can see half the inputs all return 0 and still not know whether the function is constant. Deutsch–Jozsa needs **one**, for any $n$.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'The Circuit',
      blocks: [
        {
          kind: 'text',
          text: 'Identical in shape to Deutsch, just wider: Hadamard everything, query once, Hadamard the input register, measure.',
        },
        { kind: 'circuit', preset: 'deutsch-jozsa', caption: 'The oracle computes $f(x) = x_0 \\oplus x_1$, which is balanced.' },
        {
          kind: 'text',
          text: 'The rule is stark: **all zeros means constant; anything else means balanced.** There is no ambiguity and no repetition needed.',
        },
      ],
    },
    {
      id: 'why',
      title: 'Why All-Zeros Is the Signal',
      blocks: [
        {
          kind: 'text',
          text: 'After the kickback the input register holds $\\frac{1}{\\sqrt{2^n}}\\sum_x (-1)^{f(x)}|x\\rangle$. The final Hadamards give the all-zeros outcome an amplitude of',
        },
        { kind: 'math', tex: '\\frac{1}{2^n}\\sum_{x} (-1)^{f(x)}' },
        {
          kind: 'text',
          text: 'If $f$ is constant every term has the same sign, the sum is $\\pm 2^n$, and the amplitude is $\\pm 1$ — you get all zeros with certainty. If $f$ is balanced the $+1$s and $-1$s cancel exactly, the amplitude is 0, and all zeros becomes **impossible**. Perfect destructive interference is doing the work.',
        },
      ],
    },
    {
      id: 'caveat',
      title: 'An Honest Caveat',
      blocks: [
        {
          kind: 'callout',
          tone: 'warn',
          title: 'The exponential gap needs the word "deterministic"',
          text: 'Allow a classical algorithm to be randomised and accept a tiny error probability, and a handful of random samples settles it: if any two differ, it is balanced. The exponential separation is against *exact* classical algorithms only.',
        },
        {
          kind: 'text',
          text: 'It is also a **promise problem** — the guarantee that $f$ is constant or balanced is doing real work, and no natural problem arrives with that promise attached. Deutsch–Jozsa is a proof of principle, not a useful tool. Simon’s algorithm, two pages on, is where the separation survives randomisation.',
        },
      ],
    },
  ],
}

const bernsteinVazirani: Topic = {
  slug: 'bernstein-vazirani',
  title: 'Bernstein–Vazirani',
  blurb: 'Extract an n-bit hidden string in a single query instead of n.',
  estMinutes: 20,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'The oracle hides a secret string $s$ and computes the parity of $x$ masked by it:',
        },
        { kind: 'math', tex: 'f(x) = s \\cdot x \\bmod 2 = s_0x_0 \\oplus s_1x_1 \\oplus \\cdots \\oplus s_{n-1}x_{n-1}' },
        {
          kind: 'text',
          text: 'Classically, each query returns a single parity bit, so you need $n$ of them — query $x = 100\\ldots0$ to read $s_0$, and so on. One bit in, one bit out.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'One Query, Whole String',
      blocks: [
        {
          kind: 'text',
          text: 'The circuit is again Hadamard–oracle–Hadamard. But now the measurement returns $s$ itself, in full, every time.',
        },
        { kind: 'circuit', preset: 'bernstein-vazirani', caption: 'Hidden string $s = 1011$. There is one CNOT for each 1-bit of $s$ — the oracle’s structure is visible here only because we built it.' },
        {
          kind: 'text',
          text: 'Add or remove a CNOT in the Circuit Lab and the measured string tracks it exactly. Four classical queries collapse into one.',
        },
      ],
    },
    {
      id: 'why',
      title: 'Why It Works',
      blocks: [
        {
          kind: 'text',
          text: 'After kickback the register is $\\frac{1}{\\sqrt{2^n}}\\sum_x (-1)^{s \\cdot x}|x\\rangle$. That is precisely what you get by applying $H^{\\otimes n}$ to the state $|s\\rangle$ — and since $H$ is its own inverse, a second round of Hadamards takes it straight back:',
        },
        { kind: 'math', tex: 'H^{\\otimes n}\\Big(\\tfrac{1}{\\sqrt{2^n}}\\textstyle\\sum_x (-1)^{s \\cdot x}|x\\rangle\\Big) = |s\\rangle' },
        {
          kind: 'text',
          text: 'The oracle wrote $s$ into the *phases*, where a single query could reach all $2^n$ of them at once, and the Hadamards converted phase back into something measurable. Encode in phase, read out by interference — that pattern is the core of nearly every quantum algorithm worth knowing.',
        },
      ],
    },
  ],
}

const simon: Topic = {
  slug: 'simons-algorithm',
  title: 'Simon’s Algorithm',
  blurb: 'The first exponential speedup that survives randomisation — and the direct ancestor of Shor.',
  estMinutes: 30,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'The oracle computes a function that is two-to-one with a hidden period $s$:',
        },
        { kind: 'math', tex: 'f(x) = f(y) \\iff y = x \\oplus s' },
        {
          kind: 'text',
          text: 'Find $s$. Classically you are hunting for a collision, and by the birthday bound you need about $2^{n/2}$ queries before two outputs coincide — **even allowing randomness**. Simon’s algorithm needs about $n$.',
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Why this one matters',
          text: 'Deutsch–Jozsa’s advantage evaporates against a randomised classical algorithm. Simon’s does not. This is the first genuine exponential separation, and it is the template Shor later applies to periodicity over the integers.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'The Circuit',
      blocks: [
        {
          kind: 'text',
          text: 'Hadamard the input register, query the oracle once, Hadamard again, and measure. Unlike the previous algorithms this does **not** hand you the answer directly — it gives one random $y$ satisfying $y \\cdot s = 0 \\bmod 2$.',
        },
        { kind: 'circuit', preset: 'simon', caption: 'Period $s = 11$. Only $y = 00$ and $y = 11$ ever appear, and both satisfy $y \\cdot s = 0$.' },
      ],
    },
    {
      id: 'classical-half',
      title: 'Finishing It Classically',
      blocks: [
        {
          kind: 'text',
          text: 'Each run yields one linear equation in the unknown bits of $s$. Collect about $n-1$ independent ones and solve the system by Gaussian elimination — ordinary classical linear algebra.',
        },
        {
          kind: 'text',
          text: 'In the worked example $s$ has two bits and the useful equation is $y_0 \\oplus y_1 = 0$ from $y = 11$, giving $s_0 = s_1$ and hence $s = 11$ (since $s = 00$ would make $f$ one-to-one). Runs that return $y = 00$ are wasted — they say nothing — which is why the count is *about* $n$ rather than exactly.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'The shape to remember',
          text: 'A quantum subroutine that samples constraints, plus classical post-processing that solves them. Shor has exactly this structure, with continued fractions in place of Gaussian elimination.',
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Tier 3 — amplitude and phase
// ---------------------------------------------------------------------------

const grover: Topic = {
  slug: 'grovers-search',
  title: 'Grover’s Search',
  blurb: 'Search an unstructured space of N items in √N steps — provably the best possible.',
  estMinutes: 35,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'You have $N$ items and a way to recognise the one you want, but no structure to exploit — no sorting, no index. Classically you check them one at a time and expect to look at about $N/2$.',
        },
        {
          kind: 'text',
          text: 'Grover finds it in $O(\\sqrt N)$ queries. For a million items that is roughly a thousand steps instead of half a million.',
        },
      ],
    },
    {
      id: 'mechanism',
      title: 'Amplitude Amplification',
      summary: 'Two reflections that rotate the state toward the answer.',
      blocks: [
        {
          kind: 'text',
          text: 'Start in an even superposition, where every item has amplitude $1/\\sqrt N$. Then repeat two steps:',
        },
        {
          kind: 'list',
          ordered: true,
          items: [
            '**Oracle.** Flip the *sign* of the marked item’s amplitude. Nothing is measurable yet — probabilities are unchanged, since $|-a|^2 = |a|^2$.',
            '**Diffuser.** Reflect every amplitude about their mean. The marked item, now sitting below the mean, is thrown far above it; everything else creeps down slightly.',
          ],
        },
        {
          kind: 'text',
          text: 'Each round is a small rotation in the two-dimensional plane spanned by "the marked state" and "everything else". After roughly $\\frac{\\pi}{4}\\sqrt N$ rotations the state points almost exactly at the answer.',
        },
        {
          kind: 'callout',
          tone: 'warn',
          title: 'You can overshoot',
          text: 'The rotation does not stop when it reaches the target — keep going and it swings past, and the success probability falls again. Grover needs the *right* number of iterations, which means knowing roughly how many solutions there are.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'The Circuit',
      blocks: [
        {
          kind: 'text',
          text: 'With $N = 4$ the optimal count is a single iteration, and it is exact — the marked item comes out with probability 1.',
        },
        { kind: 'circuit', preset: 'grover', caption: 'The CZ marks $|11\\rangle$; the $H$–$X$–CZ–$X$–$H$ sandwich is the diffuser.' },
        {
          kind: 'text',
          text: 'Step through it column by column in the Circuit Lab. After the oracle the **Probabilities** tab looks completely unchanged — all four still at 25%. The sign flip only becomes visible in the **State** tab, where one amplitude has turned negative. The diffuser is what converts that hidden phase into probability.',
        },
      ],
    },
    {
      id: 'limits',
      title: 'Only Quadratic, and That Is Provably It',
      blocks: [
        {
          kind: 'text',
          text: 'Grover is often described as making search "exponentially faster". It does not — the speedup is quadratic, and $O(\\sqrt N)$ is still exponential in the number of bits of input.',
        },
        {
          kind: 'text',
          text: 'It is also **optimal**: no quantum algorithm can search an unstructured space in fewer than $\\Omega(\\sqrt N)$ queries. That is a proven lower bound, not a gap waiting to be closed. For a quantum computer to do dramatically better, the problem must have structure — which is precisely what Shor exploits.',
        },
      ],
    },
  ],
}

const qft: Topic = {
  slug: 'quantum-fourier-transform',
  title: 'Quantum Fourier Transform',
  blurb: 'The engine behind every exponential speedup — but useless on its own.',
  estMinutes: 35,
  sections: [
    {
      id: 'problem',
      title: 'What It Computes',
      blocks: [
        {
          kind: 'text',
          text: 'The QFT is the discrete Fourier transform acting on amplitudes:',
        },
        { kind: 'math', tex: '|j\\rangle \;\\longmapsto\; \\frac{1}{\\sqrt{N}}\\sum_{k=0}^{N-1} e^{2\\pi i jk/N}\\,|k\\rangle, \\qquad N = 2^n' },
        {
          kind: 'text',
          text: 'A basis state becomes an even superposition whose **phases wind** at a rate set by $j$. Fast classical FFT costs $O(N \\log N)$; the QFT costs $O(n^2) = O((\\log N)^2)$ gates — exponentially fewer.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'The Circuit',
      blocks: [
        {
          kind: 'text',
          text: 'The pattern per wire is: one Hadamard, then a controlled phase rotation from each wire below it, halving the angle each time. A final round of swaps reverses the bit order.',
        },
        { kind: 'circuit', preset: 'qft', caption: 'Three-qubit QFT of $|001\\rangle$. Every outcome ends at 12.5% — the information is entirely in the phases.' },
        {
          kind: 'text',
          text: 'Look at the **State** tab rather than Probabilities. The magnitudes are flat and uninformative; the phase column steps by exactly an eighth turn each time. Change the input to $|010\\rangle$ and the phase advances twice as fast.',
        },
      ],
    },
    {
      id: 'catch',
      title: 'Why You Cannot Use It Directly',
      blocks: [
        {
          kind: 'callout',
          tone: 'warn',
          title: 'The transform is exponentially fast; reading it out is not',
          text: 'The QFT places $2^n$ Fourier coefficients into amplitudes, but measurement returns one basis state, not the amplitudes. You cannot extract the spectrum. Attempting to read all coefficients needs exponentially many repetitions, which throws the entire speedup away.',
        },
        {
          kind: 'text',
          text: 'So the QFT is never the last step. It is a subroutine that concentrates *one* useful number — a period, a phase — onto an outcome that a single measurement can reveal. The next page is what makes it usable.',
        },
      ],
    },
  ],
}

const phaseEstimation: Topic = {
  slug: 'phase-estimation',
  title: 'Quantum Phase Estimation',
  blurb: 'Turn the QFT into a measuring instrument: read an eigenvalue’s phase into binary digits.',
  estMinutes: 35,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'Given a unitary $U$ and one of its eigenstates $|u\\rangle$, with',
        },
        { kind: 'math', tex: 'U|u\\rangle = e^{2\\pi i \\varphi}|u\\rangle' },
        {
          kind: 'text',
          text: 'estimate $\\varphi$. The phase is invisible to direct measurement — a global phase on a state changes nothing observable. Phase estimation makes it readable by moving it onto a separate register.',
        },
      ],
    },
    {
      id: 'mechanism',
      title: 'How It Works',
      blocks: [
        {
          kind: 'list',
          ordered: true,
          items: [
            'Put $t$ counting qubits into an even superposition.',
            'Apply $U^{2^k}$ to the eigenstate, controlled by counting qubit $k$. By kickback each control picks up a phase $e^{2\\pi i 2^k \\varphi}$ — doubling the rotation each wire down.',
            'The counting register now holds $\\varphi$ written in binary across its phases. Apply an **inverse** QFT to convert those phases into a basis state, and measure.',
          ],
        },
        {
          kind: 'text',
          text: 'The result read as a binary fraction $0.b_1b_2\\ldots b_t$ is your estimate of $\\varphi$. Each extra counting qubit buys one more bit of precision.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'The Circuit',
      blocks: [
        {
          kind: 'text',
          text: 'Here $U$ is the $T$ gate, whose eigenvalue on $|1\\rangle$ is $e^{i\\pi/4}$, giving $\\varphi = 1/8$. In binary that is $0.001$ — and three counting wires read it exactly.',
        },
        { kind: 'circuit', preset: 'phase-estimation', caption: 'Measuring 001 means $\\varphi = 0\\cdot\\tfrac12 + 0\\cdot\\tfrac14 + 1\\cdot\\tfrac18 = \\tfrac18$.' },
        {
          kind: 'text',
          text: 'In the Circuit Lab, double all three phase angles so $U$ becomes $S$ with $\\varphi = 1/4$; the answer becomes 010. Set them to zero and you get 000.',
        },
      ],
    },
    {
      id: 'exact',
      title: 'When the Answer Is Not Exact',
      blocks: [
        {
          kind: 'text',
          text: 'The examples above are exact because $1/8$ and $1/4$ fit in three binary digits. A phase like $1/3$ does not, and the measurement instead returns a *distribution* peaked at the nearest representable value. More counting qubits narrow the peak.',
        },
        {
          kind: 'text',
          text: 'Phase estimation is the workhorse behind Shor, quantum chemistry simulation, and the HHL linear-systems algorithm. Whenever a quantum algorithm claims an exponential speedup, this is usually the machinery underneath.',
        },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// Tier 4 — synthesis
// ---------------------------------------------------------------------------

const shor: Topic = {
  slug: 'shors-algorithm',
  title: 'Shor’s Algorithm',
  blurb: 'Factor large integers in polynomial time — the result that made everyone care.',
  estMinutes: 45,
  sections: [
    {
      id: 'problem',
      title: 'The Problem',
      blocks: [
        {
          kind: 'text',
          text: 'Given a composite $N$, find its factors. The best known classical algorithm takes time roughly $\\exp(n^{1/3})$ for an $n$-bit number — fast enough that 2048-bit RSA is considered safe. Shor does it in about $O(n^3)$.',
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Why this one made the news',
          text: 'RSA security rests entirely on factoring being hard. Shor does not chip away at that — it removes it. This single result is why governments fund quantum computing and why post-quantum cryptography exists.',
        },
      ],
    },
    {
      id: 'reduction',
      title: 'Factoring Is Really Period Finding',
      blocks: [
        {
          kind: 'text',
          text: 'The quantum part of Shor does not factor anything. It finds a period, and a piece of classical number theory turns that into factors. Pick a random $a < N$ with $\\gcd(a, N) = 1$ and consider',
        },
        { kind: 'math', tex: 'f(x) = a^x \\bmod N' },
        {
          kind: 'text',
          text: 'This is periodic: $f(x + r) = f(x)$, where $r$ is the **order** of $a$. If $r$ is even and $a^{r/2} \\not\\equiv -1$, then $\\gcd(a^{r/2} \\pm 1, N)$ gives a non-trivial factor. Finding $r$ is the hard part, and that is what the quantum computer does — by phase estimation on the "multiply by $a$" operator.',
        },
      ],
    },
    {
      id: 'circuit',
      title: 'A Circuit That Actually Runs',
      blocks: [
        {
          kind: 'text',
          text: 'Factoring 15 with $a = 4$. This fits in seven wires because of a happy accident: $15 = 2^4 - 1$, so multiplying by a power of two modulo 15 is exactly a **cyclic rotation of the bits**. Multiplication by 4 costs two SWAPs instead of a full modular-arithmetic network.',
        },
        { kind: 'circuit', preset: 'shor', caption: 'Three counting wires, four work wires starting at $|0001\\rangle = 1$. Since $4^2 = 16 \\equiv 1$, we have $r = 2$ and $U^2 = I$ — so only the last counting wire does anything.' },
        {
          kind: 'text',
          text: 'Run shots and you get 000 or 100, half each. Reading 100 as the binary fraction $0.100 = 1/2$ gives $s/r = 1/2$, so $r = 2$. Then $\\gcd(4 - 1, 15) = 3$ and $\\gcd(4 + 1, 15) = 5$. And $3 \\times 5 = 15$.',
        },
      ],
    },
    {
      id: 'honesty',
      title: 'How Far This Is From Breaking RSA',
      blocks: [
        {
          kind: 'callout',
          tone: 'warn',
          title: 'This demo is a compiled special case',
          text: 'The circuit above works because we chose $a = 4$ and $N = 15$ so that modular multiplication degenerates into swaps. A general implementation needs full modular exponentiation — adders, multipliers, comparators — which dominates the gate count entirely.',
        },
        {
          kind: 'list',
          items: [
            'Factoring a 2048-bit RSA key needs roughly **4000 logical qubits** and on the order of $10^{10}$ gates.',
            'Those must be *error-corrected* logical qubits; current estimates put the physical cost in the millions.',
            'The largest numbers factored by genuine, uncompiled Shor remain tiny. Widely-reported "record factorisations" almost always smuggle the answer into the circuit design.',
          ],
        },
        {
          kind: 'text',
          text: 'None of which makes the threat hypothetical: encrypted traffic captured today can be stored and broken later, which is why migration to post-quantum cryptography is already underway.',
        },
      ],
    },
  ],
}

export const ALGORITHM_TOPICS: Topic[] = [
  qrng,
  bellStates,
  superdense,
  teleportation,
  deutsch,
  deutschJozsa,
  bernsteinVazirani,
  simon,
  grover,
  qft,
  phaseEstimation,
  shor,
]
