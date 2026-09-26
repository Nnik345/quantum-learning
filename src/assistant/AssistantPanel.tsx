import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { getTopic } from '../content/registry'
import { health as pythonHealth } from '../lib/python/client'
import { DEFAULT_MODEL } from '../lib/llm/client'
import { useAssistant } from './useAssistant'
import { MessageView } from './MessageView'
import { usePanelSize, type ResizeEdge } from './usePanelSize'
import { useModelChoice, formatSize } from './useModelChoice'

const STATUS_LABEL: Record<string, string> = {
  thinking: 'Thinking…',
  working: 'Checking the simulator…',
  streaming: 'Writing…',
}

const SUGGESTIONS = [
  'Build a Bell state',
  'What is phase kickback?',
  'Explain this page',
  'What does my circuit do?',
]

/**
 * The floating tutor.
 *
 * Page-aware: it passes the current route and topic into the system prompt, so "explain this"
 * resolves to whatever the reader is looking at without them having to name it.
 */
export function AssistantPanel() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  /** What the Python service has installed, so the tutor writes against this environment. */
  const [pythonPackages, setPythonPackages] = useState<string[]>()
  const location = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Derive the topic from the path rather than from route params, since the panel sits above the
  // <Routes> and has no params of its own.
  const context = useMemo(() => {
    const [, trackId, slug] = location.pathname.split('/')
    const topic = trackId && slug ? getTopic(trackId, slug) : undefined
    return {
      path: location.pathname,
      topicTitle: topic?.title,
      currentSlug: topic?.slug,
      onPythonPage: location.pathname.startsWith('/python'),
      pythonPackages,
    }
  }, [location.pathname, pythonPackages])

  // Asked for once, when the reader first reaches a Python page. The inventory does not change
  // while the service is up, and the tutor is no use on other pages knowing it.
  useEffect(() => {
    if (!context.onPythonPage || pythonPackages) return
    const controller = new AbortController()
    pythonHealth(controller.signal).then((state) => {
      if (state.ok && state.packages?.length) setPythonPackages(state.packages)
    })
    return () => controller.abort()
  }, [context.onPythonPage, pythonPackages])

  const models = useModelChoice()
  const { messages, status, health, send, stop, clear, checkHealth } = useAssistant(
    context,
    models.model,
  )

  /*
   * Retire the "loading" note once a reply has actually come back on the newly-chosen model, which
   * is the moment it is resident. Waiting for `idle` alone is not enough: status is already idle when
   * the reader picks a model, so the note would clear before the request it is warning about.
   */
  const requested = useRef(false)
  useEffect(() => {
    if (status !== 'idle') requested.current = true
    else if (requested.current) {
      requested.current = false
      models.settled()
    }
  }, [models, status])
  const panel = usePanelSize()
  const busy = status !== 'idle'

  // Only reach for Ollama once the reader actually opens the panel — a visitor who never asks a
  // question should not cause a request at all.
  useEffect(() => {
    if (open) void checkHealth()
  }, [open, checkHealth])

  useEffect(() => {
    // scrollTo is optional on Element in some environments; scrolling is a nicety, not a feature.
    const el = scrollRef.current
    el?.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const submit = () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    void send(text)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open the tutor"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-cyan bg-surface px-4 py-2.5 text-sm text-cyan shadow-lg transition-colors hover:bg-cyan/10"
      >
        <span aria-hidden>✦</span> Ask
      </button>
    )
  }

  return (
    <div
      style={panel.style}
      className={[
        'fixed bottom-0 right-0 z-40 flex h-[min(620px,100dvh)] w-full flex-col border-l border-t',
        'border-line bg-surface shadow-2xl sm:bottom-5 sm:right-5 sm:h-[620px] sm:w-[420px]',
        'sm:rounded-xl sm:border',
        // No transition while dragging, or the panel lags behind the pointer.
        panel.resizing ? '' : 'transition-[width,height] duration-100',
      ].join(' ')}
    >
      {panel.isDesktop && (
        <>
          {/* Edges first, corner last: the corner sits on top where they overlap. */}
          <ResizeHandle panel={panel} edge="top" />
          <ResizeHandle panel={panel} edge="left" />
          <ResizeHandle panel={panel} edge="corner" />
        </>
      )}
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-sm font-medium text-ink">Tutor</span>
        <span className="truncate text-[10px] text-ink-faint">
          {context.topicTitle ?? context.path}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {models.available.length > 1 && (
            <select
              value={models.model}
              onChange={(e) => models.choose(e.target.value)}
              aria-label="Model"
              title="Larger models answer better and run slower. Switching reloads the model."
              className="max-w-[9.5rem] truncate rounded border border-line bg-ground px-1.5 py-0.5 text-[11px] text-ink-dim outline-none transition-colors hover:text-ink focus:border-cyan"
            >
              {models.available.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                  {m.sizeBytes ? ` \u00b7 ${formatSize(m.sizeBytes)}` : ''}
                </option>
              ))}
            </select>
          )}
          {messages.length > 0 && (
            <button
              onClick={clear}
              className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:text-ink"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close the tutor"
            className="rounded border border-line px-2 py-0.5 text-[11px] text-ink-faint transition-colors hover:text-ink"
          >
            ✕
          </button>
        </div>
      </header>

      {health && !health.ok && (
        <div className="border-b border-amber/30 bg-amber/5 px-3 py-2 text-[11px] leading-5 text-amber">
          {health.error}
          {health.modelMissing && (
            <div className="mt-0.5 font-mono text-ink-faint">ollama pull {DEFAULT_MODEL}</div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-[13px] leading-6 text-ink-dim">
              Ask about anything on the site, or describe a circuit and I will build it in the
              simulator.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setDraft('')
                    void send(s)
                  }}
                  className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-dim transition-colors hover:border-cyan hover:text-cyan"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-4 text-ink-faint">
              Answers come from a local model. It tries to be correct and is grounded in this
              site&rsquo;s own lessons, but it can still get things wrong — treat explanations as a
              starting point, not an authority.
              <br />
              Circuits are the exception: every one is run through the simulator before you see it,
              so the numbers under a diagram are always real, even if the words around it are not.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageView key={message.id} message={message} />
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-[11px] text-ink-faint">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-cyan" />
            {STATUS_LABEL[status] ?? 'Working…'}
            {/* A switch evicts the resident model and cold-loads the new one; on a card that cannot
                hold both that is tens of seconds, and silence looks like a hang. */}
            {models.switching && <span>· loading {models.model}, first reply will be slow</span>}
          </div>
        )}
      </div>

      <div className="border-t border-line p-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            rows={2}
            placeholder="Ask a question, or describe a circuit…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            className="min-w-0 flex-1 resize-none rounded-md border border-line bg-ground px-2 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-cyan"
          />
          {busy ? (
            <button
              onClick={stop}
              className="rounded-md border border-line px-3 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="rounded-md border border-cyan bg-cyan/10 px-3 py-1.5 text-xs text-cyan transition-colors hover:bg-cyan/20 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>

        <p className="mt-1.5 px-0.5 text-center text-[10px] leading-4 text-ink-faint">
          This tutor aims to be accurate but can still be wrong — check anything important against
          the lesson pages.
        </p>
      </div>
    </div>
  )
}

/**
 * One resize handle: the top edge, the left edge, or the corner that does both.
 *
 * The strip straddles the border — half outside the panel, half over it — so there is a grabbable
 * target without a visible gutter eating into the layout. Nothing is drawn until hover or focus,
 * which keeps three handles from cluttering a panel whose job is reading.
 */
function ResizeHandle({
  panel,
  edge,
}: {
  panel: ReturnType<typeof usePanelSize>
  edge: ResizeEdge
}) {
  const size = `${panel.size.width} × ${panel.size.height}`
  const config = {
    top: {
      label: 'Resize the tutor height. Drag, or use the up and down arrow keys.',
      orientation: 'horizontal' as const,
      hint: 'Drag up to make the tutor taller',
      box: 'inset-x-0 -top-1 h-2 cursor-ns-resize',
      line: 'inset-x-3 top-1/2 h-0.5 -translate-y-1/2',
    },
    left: {
      label: 'Resize the tutor width. Drag, or use the left and right arrow keys.',
      orientation: 'vertical' as const,
      hint: 'Drag left to make the tutor wider',
      box: 'inset-y-0 -left-1 w-2 cursor-ew-resize',
      line: 'inset-y-3 left-1/2 w-0.5 -translate-x-1/2',
    },
    corner: {
      label: 'Resize the tutor from the corner. Drag, or use the arrow keys.',
      orientation: 'vertical' as const,
      hint: 'Drag to resize both directions',
      box: '-left-1 -top-1 size-5 cursor-nwse-resize rounded-tl-xl',
      line: '',
    },
  }[edge]

  return (
    <div
      role="separator"
      aria-label={config.label}
      aria-orientation={config.orientation}
      tabIndex={0}
      onPointerDown={(event) => panel.startResize(event, edge)}
      onKeyDown={(event) => panel.nudge(event, edge)}
      onDoubleClick={panel.reset}
      title={
        panel.isDefaultSize ? `${config.hint} — double-click to reset` : `${size} — double-click to reset`
      }
      className={[
        'group absolute z-10 touch-none focus:outline-none',
        edge === 'corner' ? 'z-20' : '',
        config.box,
      ].join(' ')}
    >
      {edge === 'corner' ? (
        /* Two short strokes reading as a corner grip, brightening on hover and focus. */
        <svg viewBox="0 0 20 20" className="size-full text-line-bright hover:text-cyan group-focus-visible:text-cyan" aria-hidden>
          <path d="M4 13 L4 4 L13 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M8 16 L8 8 L16 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
        </svg>
      ) : (
        <span
          aria-hidden
          className={[
            'absolute rounded-full bg-transparent transition-colors',
            'group-hover:bg-cyan/60 group-focus-visible:bg-cyan',
            config.line,
          ].join(' ')}
        />
      )}
    </div>
  )
}
