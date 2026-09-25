import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { HighlightStyle, syntaxHighlighting, indentUnit, bracketMatching } from '@codemirror/language'
import { tags } from '@lezer/highlight'

/**
 * The Python editor.
 *
 * CodeMirror rather than a textarea, because this is where people write code: it brings a real
 * Python grammar, bracket matching, and indentation that behaves the way Python demands.
 *
 * The theme is built from the site's own tokens rather than importing one, so the editor looks like
 * part of the page instead of a widget dropped onto it. Colours follow the roles used elsewhere:
 * cyan for the things you call, violet for keywords, amber for literals, faint for comments.
 */

const syntax = HighlightStyle.define([
  { tag: tags.comment, color: 'var(--color-ink-faint)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--color-violet)' },
  { tag: [tags.controlKeyword, tags.moduleKeyword], color: 'var(--color-violet)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--color-emerald)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--color-amber)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--color-cyan)' },
  { tag: tags.definition(tags.variableName), color: 'var(--color-ink)' },
  { tag: tags.propertyName, color: 'var(--color-ink)' },
  { tag: tags.className, color: 'var(--color-cyan)' },
  { tag: tags.operator, color: 'var(--color-ink-dim)' },
  { tag: tags.punctuation, color: 'var(--color-ink-dim)' },
  { tag: tags.self, color: 'var(--color-violet)' },
])

const theme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--color-ground)',
      color: 'var(--color-ink)',
      fontSize: '13px',
    },
    '.cm-content': {
      fontFamily: 'var(--font-mono)',
      padding: '10px 0',
      caretColor: 'var(--color-cyan)',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--color-ground)',
      color: 'var(--color-ink-faint)',
      border: 'none',
      paddingRight: '4px',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-ink-dim)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-cyan)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'rgba(34, 211, 238, 0.25)',
    },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
      backgroundColor: 'rgba(34, 211, 238, 0.18)',
      outline: 'none',
    },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  },
  { dark: true },
)

export interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  /** Read-only renderers get highlighting without a cursor, for the guide's worked samples. */
  readOnly?: boolean
  /** Fired on Ctrl/Cmd+Enter, so Run works from inside the editor. */
  onSubmit?: () => void
  minHeight?: string
  ariaLabel?: string
}

export default function CodeMirrorEditor({
  value,
  onChange,
  readOnly = false,
  onSubmit,
  minHeight = '280px',
  ariaLabel = 'Python code',
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView>()
  // Held in a ref so changing the handler never forces the editor to be rebuilt mid-typing.
  const submit = useRef(onSubmit)
  submit.current = onSubmit

  useEffect(() => {
    if (!host.current) return

    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      bracketMatching(),
      highlightActiveLine(),
      indentUnit.of('    '), // four spaces, as Python expects
      python(),
      syntaxHighlighting(syntax),
      theme,
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
      EditorView.editable.of(!readOnly),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel }),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            submit.current?.()
            return true
          },
        },
        indentWithTab,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange?.(update.state.doc.toString())
      }),
    ]

    const editor = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host.current,
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = undefined
    }
    // Rebuilt only when the mode changes; `value` is synced by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, ariaLabel])

  /*
   * Push an externally-changed value in without disturbing someone mid-edit: the guard means
   * loading a different example replaces the document, but each keystroke does not round-trip.
   */
  useEffect(() => {
    const editor = view.current
    if (!editor || editor.state.doc.toString() === value) return
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
  }, [value])

  return (
    <div
      ref={host}
      style={{ minHeight }}
      className="overflow-auto [&_.cm-editor]:min-h-[inherit] [&_.cm-scroller]:min-h-[inherit]"
    />
  )
}
