import { Link } from 'react-router-dom'

import { PATH, PATH_LENGTH, STAGES } from '../content/path'
import { useProgress } from '../learning/useProgress'
import { ALGORITHM_PRESETS } from '../lib/quantum/presets'
import { BUILTIN_GATES } from '../lib/quantum/gates'
import { MAX_QUBITS } from '../lib/quantum/state'
import { presetPage } from '../lib/llm/retrieval'

/**
 * The landing page: what this site is, before you commit to step one.
 *
 * The ordered path moved to /path when this arrived. A newcomer arriving cold needs to know what
 * they are looking at and what they can do here; someone returning wants the shortest route back to
 * where they stopped, which is why the banner's main button changes once there is any progress.
 *
 * Every number on this page is counted from the real content — nothing is typed in by hand, so a
 * new topic or preset cannot leave the front door advertising a stale figure.
 */
export function Home() {
  const progress = useProgress()
  const resumeTo = progress.next ? `/${progress.next.trackId}/${progress.next.slug}` : '/path'

  return (
    <>
      <Banner progress={progress} resumeTo={resumeTo} />
      <Stats />
      <Features />
      <Journey />
      <Algorithms />
      <Convention />
      <ClosingCta resumeTo={resumeTo} isFresh={progress.isFresh} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function Banner({
  progress,
  resumeTo,
}: {
  progress: ReturnType<typeof useProgress>
  resumeTo: string
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-line">
      <BannerBackdrop />

      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-center lg:gap-16 lg:py-24">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan backdrop-blur">
            <span className="size-1.5 rounded-full bg-cyan ql-breathe" aria-hidden />
            Interactive · runs in your browser
          </p>

          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-balance sm:text-5xl">
            Quantum computing,
            <br />
            <span className="bg-gradient-to-r from-cyan via-cyan to-violet bg-clip-text text-transparent">
              built one gate at a time.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-8 text-ink-dim sm:text-[17px]">
            A {PATH_LENGTH}-step route from complex numbers to Shor&rsquo;s algorithm — with a circuit
            board that really simulates, a tutor that runs on your own machine, and a verified
            circuit behind every algorithm.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={resumeTo}
              className="group inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-3 text-sm font-semibold text-ground transition-transform hover:-translate-y-0.5"
            >
              {progress.isFresh ? 'Start at step 1' : `Resume — step ${progress.completedCount + 1}`}
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </Link>
            <Link
              to="/circuit"
              className="inline-flex items-center gap-2 rounded-lg border border-line-bright px-5 py-3 text-sm text-ink transition-colors hover:border-cyan hover:text-cyan"
            >
              Open the Circuit Lab
            </Link>
          </div>

          {!progress.isFresh && (
            <p className="mt-5 text-xs text-ink-faint">
              {progress.completedCount} of {progress.total} steps complete · {progress.percent}%
            </p>
          )}
        </div>

        <div className="hidden lg:block">
          <HeroArt />
        </div>
      </div>
    </section>
  )
}

/** Layered glow and grid behind the banner. Purely decorative, and entirely non-interactive. */
function BannerBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      {/* Faint engineering grid, faded out towards the edges so it never reads as a border. */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--color-line) 1px, transparent 1px), linear-gradient(to bottom, var(--color-line) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 100%)',
        }}
      />
      <div
        className="absolute -left-40 -top-40 size-[520px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--color-cyan) 18%, transparent), transparent 70%)' }}
      />
      <div
        className="absolute -right-32 top-10 size-[460px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--color-violet) 20%, transparent), transparent 70%)' }}
      />
    </div>
  )
}

/**
 * The orbital motif from the logo, drawn large.
 *
 * Three rings on different axes with a bright core, plus a wire carrying a travelling pulse — the
 * two things this site is about, superposition and circuits, in one picture.
 */
function HeroArt() {
  return (
    <div className="relative ql-drift">
      <svg viewBox="0 0 420 420" className="w-full" role="img" aria-label="An orbiting qubit state above a quantum wire">
        <defs>
          <radialGradient id="ql-core">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="60%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0e7490" />
          </radialGradient>
          <linearGradient id="ql-wire" x1="0" x2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
            <stop offset="50%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Orbits, counter-rotating so the composition never sits still. */}
        <g className="ql-orbit">
          <ellipse cx="210" cy="180" rx="150" ry="58" fill="none" stroke="#a78bfa" strokeWidth="1.4" opacity="0.65" />
          <circle cx="360" cy="180" r="5" fill="#a78bfa" />
        </g>
        <g className="ql-orbit-slow">
          <ellipse cx="210" cy="180" rx="150" ry="58" fill="none" stroke="#22d3ee" strokeWidth="1.4" opacity="0.5" transform="rotate(60 210 180)" />
        </g>
        <g className="ql-orbit">
          <ellipse cx="210" cy="180" rx="150" ry="58" fill="none" stroke="#a78bfa" strokeWidth="1.4" opacity="0.35" transform="rotate(120 210 180)" />
        </g>

        {/* The state itself. */}
        <circle cx="210" cy="180" r="34" fill="url(#ql-core)" opacity="0.18" />
        <circle cx="210" cy="180" r="13" fill="url(#ql-core)" />

        {/* A wire with two gates and a pulse running along it. */}
        <line x1="40" y1="330" x2="380" y2="330" stroke="var(--color-line-bright)" strokeWidth="1.5" />
        <line x1="40" y1="330" x2="380" y2="330" stroke="url(#ql-wire)" strokeWidth="2.5" className="ql-trace" strokeLinecap="round" />
        {[
          { x: 120, label: 'H' },
          { x: 210, label: 'X' },
          { x: 300, label: 'Z' },
        ].map((gate) => (
          <g key={gate.label}>
            <rect x={gate.x - 17} y={313} width="34" height="34" rx="7" fill="var(--color-surface-2)" stroke="var(--color-line-bright)" />
            <text x={gate.x} y={335} textAnchor="middle" className="fill-cyan font-mono" fontSize="15">
              {gate.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const STATS = [
  { value: String(PATH_LENGTH), label: 'steps, in order' },
  { value: String(STAGES.length), label: 'stages' },
  { value: String(ALGORITHM_PRESETS.length), label: 'verified circuits' },
  { value: String(BUILTIN_GATES.length), label: 'built-in gates' },
  { value: String(MAX_QUBITS), label: 'qubits simulated' },
]

function Stats() {
  return (
    <section className="border-b border-line bg-surface/30">
      <dl className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px px-4 py-8 sm:px-6 md:grid-cols-5">
        {STATS.map((stat) => (
          <div key={stat.label} className="px-2 py-3 text-center">
            <dt className="font-mono text-3xl font-semibold text-cyan sm:text-4xl">{stat.value}</dt>
            <dd className="mt-1 text-xs uppercase tracking-wider text-ink-faint">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: 'circuit',
    title: 'A board that really simulates',
    body: `Drag gates onto up to ${MAX_QUBITS} wires and watch the state vector, probabilities, Bloch vectors and sampled shots update as you build. ${BUILTIN_GATES.length} built-in gates, plus your own from a matrix.`,
    to: '/circuit',
    cta: 'Open the lab',
  },
  {
    icon: 'check',
    title: 'Every algorithm ships a circuit',
    body: `All ${ALGORITHM_PRESETS.length} algorithm circuits are checked against textbook results in the test suite, so what you open is what the theory says it should be — not a diagram someone drew once.`,
    to: '/algorithms',
    cta: 'See the algorithms',
  },
  {
    icon: 'spark',
    title: 'A tutor on your own machine',
    body: 'The built-in tutor runs against a local model. It reads the site’s own pages, looks up verified circuits, and runs anything it builds through the simulator before showing it to you.',
  },
  {
    icon: 'sphere',
    title: 'Maths you can turn around',
    body: 'An interactive Bloch sphere, an Argand plane, and a matrix playground — because “apply a phase” means very little until you have watched it rotate.',
    to: '/theory/qubits-and-the-bloch-sphere',
    cta: 'Try the sphere',
  },
  {
    icon: 'path',
    title: 'One order that makes sense',
    body: `${PATH_LENGTH} steps across ${STAGES.length} stages, each naming what it builds on. Nothing is locked, but you will always know whether you are reading ahead.`,
    to: '/path',
    cta: 'See the path',
  },
  {
    icon: 'book',
    title: 'Conventions stated out loud',
    body: 'Qubit q0 is the top wire and the leftmost symbol in a ket. That is textbook order, it is the reverse of Qiskit, and it is written down wherever it could trip you up.',
    to: '/reference',
    cta: 'Browse the reference',
  },
]

function Features() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading
        eyebrow="What is here"
        title="Built to be poked at"
        blurb="Reading about a superposition only gets you so far. Everything on this site is something you can change and re-run."
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="group flex flex-col rounded-xl border border-line bg-surface p-5 transition-colors hover:border-line-bright"
          >
            <FeatureIcon name={feature.icon} />
            <h3 className="mt-4 font-semibold tracking-tight text-ink">{feature.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-ink-dim">{feature.body}</p>
            {feature.to && (
              <Link
                to={feature.to}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-cyan transition-colors hover:text-ink"
              >
                {feature.cta}
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
                  →
                </span>
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** Small line-art marks. Inline rather than a dependency, and decorative rather than meaningful. */
function FeatureIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    circuit: (
      <>
        <path d="M3 8h4m10 0h4M3 16h4m10 0h4" />
        <rect x="7" y="4" width="10" height="8" rx="2" />
        <rect x="7" y="12" width="10" height="8" rx="2" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    spark: (
      <>
        <path d="M12 3v4m0 10v4M3 12h4m10 0h4" />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
    sphere: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="9" ry="3.6" />
        <path d="M12 3v18" />
      </>
    ),
    path: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M6 8.5v5a4 4 0 0 0 4 4h5.5" />
      </>
    ),
    book: (
      <>
        <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
        <path d="M17 7h2v13H8" />
      </>
    ),
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className="size-7 text-cyan"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// The journey
// ---------------------------------------------------------------------------

function Journey() {
  return (
    <section className="border-y border-line bg-surface/30">
      <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow="The route"
          title={`${STAGES.length} stages, ${PATH_LENGTH} steps`}
          blurb="Each stage ends somewhere concrete — a state you can prepare, a protocol you can run, an algorithm that beats its classical counterpart."
        />

        <ol className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage, i) => {
            const steps = PATH.filter((s) => s.stage.id === stage.id)
            const first = steps[0]
            const last = steps[steps.length - 1]
            return (
              <li
                key={stage.id}
                className="relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-5"
              >
                <span
                  className="absolute right-4 top-3 font-mono text-5xl font-semibold text-line"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="relative font-semibold tracking-tight text-ink">{stage.title}</h3>
                <p className="relative mt-2 flex-1 text-sm leading-6 text-ink-dim">{stage.blurb}</p>
                <p className="relative mt-4 font-mono text-[11px] text-ink-faint">
                  {first && last && first.step === last.step
                    ? `step ${first.step}`
                    : `steps ${first?.step}–${last?.step}`}{' '}
                  · {steps.length} {steps.length === 1 ? 'lesson' : 'lessons'}
                </p>
                {first && (
                  <Link
                    to={`/${first.trackId}/${first.slug}`}
                    className="relative mt-3 text-sm text-cyan hover:text-ink"
                  >
                    Begin {stage.title} →
                  </Link>
                )}
              </li>
            )
          })}
        </ol>

        <div className="mt-8">
          <Link to="/path" className="text-sm text-cyan hover:underline">
            See every step in order →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Algorithms
// ---------------------------------------------------------------------------

function Algorithms() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading
        eyebrow="Verified circuits"
        title="Open any of them and press run"
        blurb="Each of these is a real circuit in the simulator, not a picture. Load it, take it apart, change a gate and watch the answer stop working."
      />

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ALGORITHM_PRESETS.map((preset) => {
          const page = presetPage(preset.id)
          const qubits = preset.circuit.numQubits
          const content = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-ink group-hover:text-cyan">{preset.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-ink-faint">{qubits}q</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-ink-faint">{preset.summary}</p>
            </>
          )
          return (
            <li key={preset.id}>
              {page ? (
                <Link
                  to={`/${page.trackId}/${page.slug}`}
                  className="group flex h-full flex-col rounded-lg border border-line bg-surface px-4 py-3 transition-colors hover:border-cyan"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex h-full flex-col rounded-lg border border-line bg-surface px-4 py-3">
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Convention
// ---------------------------------------------------------------------------

function Convention() {
  return (
    <section className="border-y border-line bg-surface/30">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="max-w-2xl">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-amber">
            One thing to know up front
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Qubit q<span className="align-sub text-base">0</span> is the top wire, and the leftmost
            symbol in a ket.
          </h2>
          <p className="mt-3 text-[15px] leading-7 text-ink-dim">
            That is the textbook convention, and it is the reverse of Qiskit&rsquo;s. Every page,
            every readout and the tutor itself use this one ordering — so if a bitstring ever looks
            backwards next to something you have read elsewhere, this is why.
          </p>
        </div>

        <div className="rounded-xl border border-line bg-ground/60 p-5 font-mono text-sm">
          <div className="text-ink-faint">q0 ──── H ────</div>
          <div className="text-ink-faint">q1 ──────────</div>
          <div className="text-ink-faint">q2 ──────────</div>
          <div className="mt-3 border-t border-line pt-3 text-cyan">|q0 q1 q2⟩</div>
          <div className="mt-1 text-ink-faint">only q0 excited → |100⟩</div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

function ClosingCta({ resumeTo, isFresh }: { resumeTo: string; isFresh: boolean }) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-20 text-center sm:px-6">
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Start where it actually starts.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-ink-dim">
        Complex numbers first, because amplitudes live there. Shor&rsquo;s algorithm last, because by
        then every piece of it is something you have already built.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          to={resumeTo}
          className="rounded-lg bg-cyan px-5 py-3 text-sm font-semibold text-ground transition-transform hover:-translate-y-0.5"
        >
          {isFresh ? 'Start at step 1' : 'Pick up where you left off'}
        </Link>
        <Link
          to="/reference"
          className="rounded-lg border border-line-bright px-5 py-3 text-sm text-ink transition-colors hover:border-cyan hover:text-cyan"
        >
          Browse everything instead
        </Link>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------

function SectionHeading({
  eyebrow,
  title,
  blurb,
}: {
  eyebrow: string
  title: string
  blurb: string
}) {
  return (
    <div className="max-w-2xl">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">{eyebrow}</p>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 text-[15px] leading-7 text-ink-dim">{blurb}</p>
    </div>
  )
}
