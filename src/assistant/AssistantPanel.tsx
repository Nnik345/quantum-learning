import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { getTopic } from '../content/registry'
import { DEFAULT_MODEL } from '../lib/llm/client'
import { useAssistant } from './useAssistant'
import { MessageView } from './MessageView'

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
  const location = useLocation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Derive the topic from the path rather than from route params, since the panel sits above the
  // <Routes> and has no params of its own.
  const context = useMemo(() => {
    const [, trackId, slug] = location.pathname.split('/')
    const topic = trackId && slug ? getTopic(trackId, slug) : undefined
    return { path: location.pathname, topicTitle: topic?.title, currentSlug: topic?.slug }
  }, [location.pathname])

  const { messages, status, health, send, stop, clear, checkHealth } = useAssistant(context)
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
    <div className="fixed bottom-0 right-0 z-40 flex h-[min(620px,100dvh)] w-full flex-col border-l border-t border-line bg-surface shadow-2xl sm:bottom-5 sm:right-5 sm:h-[620px] sm:w-[420px] sm:rounded-xl sm:border">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-sm font-medium text-ink">Tutor</span>
        <span className="truncate text-[10px] text-ink-faint">
          {context.topicTitle ?? context.path}
        </span>
        <div className="ml-auto flex items-center gap-1">
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
