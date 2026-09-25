/**
 * Lazy wrapper around the Python editor.
 *
 * CodeMirror and its Python grammar are around 400 KB — comparable to the rest of the app put
 * together — and only the Python pages need them. Loading the chunk on first use keeps that cost off
 * every other page, the same arrangement three.js already has in LazyBlochSphere.
 *
 * The fallback renders the code as plain monospace text at the same size, so the editor does not
 * arrive into an empty box and nothing jumps.
 */

import { Suspense, lazy } from 'react'

import type { CodeEditorProps } from './CodeMirrorEditor'

const Editor = lazy(() => import('./CodeMirrorEditor'))

export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={<EditorPlaceholder {...props} />}>
      <Editor {...props} />
    </Suspense>
  )
}

function EditorPlaceholder({ value, minHeight = '280px' }: CodeEditorProps) {
  return (
    <div style={{ minHeight }} className="overflow-auto bg-ground px-3 py-2.5">
      <pre className="whitespace-pre font-mono text-[13px] leading-[1.6] text-ink-dim">{value}</pre>
    </div>
  )
}

export type { CodeEditorProps }
