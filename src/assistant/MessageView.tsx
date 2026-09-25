import { useState } from 'react'
import { Link } from 'react-router-dom'

import { RichText } from '../components/Tex'
import { splitLinks } from './links'
import { CircuitGrid } from '../circuit/CircuitGrid'
import { requestLoad, isBoardMounted } from '../circuit/circuitBridge'
import type { ValidationResult } from '../lib/llm/validate'
import type { DisplayMessage, PythonSnippet } from './useAssistant'
import { requestInsert, isEditorMounted } from '../lib/python/pythonBridge'

const noop = () => {}

/**
 * One line of model prose: markdown links first, then the site's own inline formatting.
 *
 * Only links to real pages here become clickable; anything else keeps its label as plain text.
 * See links.ts for why.
 */
function Line({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((segment, i) =>
        segment.kind === 'link' ? (
          <Link
            key={i}
            to={segment.href!}
            className="text-cyan underline decoration-cyan/40 underline-offset-2 hover:decoration-cyan"
          >
            {segment.text}
          </Link>
        ) : (
          <RichText key={i} text={segment.text} />
        ),
      )}
    </>
  )
}

/**
 * Model prose, rendered with the site's own inline formatting.
 *
 * Deliberately modest: paragraphs, bullets and numbered items, with `RichText` handling $maths$ and
 * **bold** exactly as the lesson pages do. A full markdown renderer would be a dependency and a
 * larger surface for a prototype to get wrong.
 */
function AssistantText({ text }: { text: string }) {
  const lines = text.split('\n')

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        const bullet = /^[-*]\s+(.*)$/.exec(trimmed)
        if (bullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-ink-faint">•</span>
              <span className="min-w-0 flex-1">
                <Line text={bullet[1]} />
              </span>
            </div>
          )
        }

        const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed)
        if (numbered) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="font-mono text-ink-faint">{numbered[1]}.</span>
              <span className="min-w-0 flex-1">
                <Line text={numbered[2]} />
              </span>
            </div>
          )
        }

        const heading = /^#{1,4}\s+(.*)$/.exec(trimmed)
        if (heading) {
          return (
            <div key={i} className="pt-1 text-[13px] font-semibold text-ink">
              <Line text={heading[1]} />
            </div>
          )
        }

        return (
          <p key={i}>
            <Line text={trimmed} />
          </p>
        )
      })}
    </div>
  )
}

/** A circuit the model proposed: rendered read-only, with the simulator's own verdict beneath. */
function ProposedCircuit({ result }: { result: ValidationResult }) {
  const [loaded, setLoaded] = useState(false)
  if (!result.circuit || !result.outcome) return null

  const load = () => {
    const where = requestLoad(result.circuit!)
    setLoaded(true)
    return where
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-ground/50">
      <div className="overflow-x-auto p-2">
        <div className="pointer-events-none w-max origin-top-left scale-90">
          <CircuitGrid
            circuit={result.circuit}
            drag={null}
            hover={null}
            inspectStep={result.circuit.columns}
            onSelect={noop}
            onInspectStep={noop}
            onGatePointerDown={noop}
            onControlHandlePointerDown={noop}
            onBackgroundPointerDown={noop}
            onEditInput={noop}
          />
        </div>
      </div>

      {/* The simulator's result, not the model's description of it. */}
      <div className="border-t border-line px-3 py-2">
        <div className="font-mono text-[11px] text-ink-dim">{result.outcome.dirac}</div>
        {result.outcome.entangled.length > 0 && (
          <div className="mt-0.5 text-[10px] text-amber">
            entangled: q{result.outcome.entangled.join(', q')}
          </div>
        )}
        {result.warnings.length > 0 && (
          <div className="mt-1 text-[10px] leading-4 text-ink-faint">
            adjusted: {result.warnings.join('; ')}
          </div>
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={load}
            className="rounded border border-cyan px-2 py-0.5 text-[11px] text-cyan transition-colors hover:bg-cyan/10"
          >
            Load into Circuit Lab
          </button>
          {loaded && !isBoardMounted() && (
            <Link to="/circuit" className="text-[11px] text-cyan hover:underline">
              open the lab →
            </Link>
          )}
          {loaded && isBoardMounted() && (
            <span className="text-[10px] text-ink-faint">loaded — Ctrl+Z to undo</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Python the tutor is offering.
 *
 * Shown, never applied: putting it in the editor is one click, and that click is the user's. The
 * tutor cannot run this and has not tested it, so the code is presented as a suggestion to read
 * rather than an answer to trust — which is the same standing its circuits have before the
 * simulator has checked them.
 */
function SuggestedPython({ snippet }: { snippet: PythonSnippet }) {
  const [inserted, setInserted] = useState(false)

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-ground/50">
      {snippet.explanation && (
        <div className="border-b border-line px-3 py-1.5 text-[11px] leading-4 text-ink-dim">
          {snippet.explanation}
        </div>
      )}
      <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-[11px] leading-5 text-ink">
        {snippet.code}
      </pre>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <button
          onClick={() => {
            requestInsert(snippet.code)
            setInserted(true)
          }}
          className="rounded border border-cyan px-2 py-0.5 text-[11px] text-cyan transition-colors hover:bg-cyan/10"
        >
          Put in my editor
        </button>
        {inserted && !isEditorMounted() && (
          <Link to="/python/playground" className="text-[11px] text-cyan hover:underline">
            open the editor →
          </Link>
        )}
        {inserted && isEditorMounted() && (
          <span className="text-[10px] text-ink-faint">inserted — Ctrl+Z to undo</span>
        )}
      </div>
    </div>
  )
}

export function MessageView({ message }: { message: DisplayMessage }) {
  const [showReasoning, setShowReasoning] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-surface-2 px-3 py-2 text-[13px] leading-6 text-ink">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {message.error ? (
        <div className="rounded-lg border border-rose/40 bg-rose/5 px-3 py-2 text-xs leading-5 text-rose">
          {message.error}
        </div>
      ) : (
        <>
          {message.thinking && (
            <div>
              <button
                onClick={() => setShowReasoning((v) => !v)}
                className="text-[10px] uppercase tracking-wider text-ink-faint transition-colors hover:text-ink-dim"
              >
                {showReasoning ? '▾ hide reasoning' : '▸ show reasoning'}
              </button>
              {showReasoning && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded border border-line bg-ground/40 px-2 py-1.5 text-[11px] leading-5 text-ink-faint">
                  {message.thinking}
                </div>
              )}
            </div>
          )}

          {message.toolsUsed.length > 0 && (
            <div className="text-[10px] text-ink-faint">
              used: {[...new Set(message.toolsUsed)].join(', ')}
            </div>
          )}

          {message.content && (
            <div className="text-[13px] leading-6 text-ink-dim">
              <AssistantText text={message.content} />
            </div>
          )}

          {message.circuits.map((circuit, i) => (
            <ProposedCircuit key={i} result={circuit} />
          ))}

          {message.snippets.map((snippet, i) => (
            <SuggestedPython key={i} snippet={snippet} />
          ))}

          {message.streaming && !message.content && (
            <div className="text-[11px] text-ink-faint">…</div>
          )}
        </>
      )}
    </div>
  )
}
