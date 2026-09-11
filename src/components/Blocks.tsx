import type { Block } from '../content/types'
import { WIDGETS } from '../content/widgets'
import { RichText, Tex } from './Tex'

const CALLOUT_TONES = {
  note: { bar: 'border-l-cyan', label: 'text-cyan' },
  tip: { bar: 'border-l-emerald', label: 'text-emerald' },
  warn: { bar: 'border-l-amber', label: 'text-amber' },
} as const

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} />
      ))}
    </div>
  )
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'text':
      return (
        <p className="text-[15px] leading-7 text-ink-dim">
          <RichText text={block.text} />
        </p>
      )

    case 'math':
      return (
        <figure className="my-5">
          <div className="overflow-x-auto rounded-lg border border-line bg-ground/50 px-4 py-3">
            <Tex tex={block.tex} display />
          </div>
          {block.caption && (
            <figcaption className="mt-2 text-center text-xs text-ink-faint">
              <RichText text={block.caption} />
            </figcaption>
          )}
        </figure>
      )

    case 'list': {
      const List = block.ordered ? 'ol' : 'ul'
      return (
        <List
          className={[
            'space-y-1.5 pl-5 text-[15px] leading-7 text-ink-dim',
            block.ordered ? 'list-decimal' : 'list-disc',
            'marker:text-ink-faint',
          ].join(' ')}
        >
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText text={item} />
            </li>
          ))}
        </List>
      )
    }

    case 'callout': {
      const tone = CALLOUT_TONES[block.tone ?? 'note']
      return (
        <aside className={`rounded-r-lg border-l-2 bg-surface/60 px-4 py-3 ${tone.bar}`}>
          {block.title && (
            <div className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${tone.label}`}>
              {block.title}
            </div>
          )}
          <div className="text-sm leading-6 text-ink-dim">
            <RichText text={block.text} />
          </div>
        </aside>
      )
    }

    case 'widget': {
      const Widget = WIDGETS[block.widget]
      if (!Widget) {
        return (
          <div className="rounded-lg border border-rose/40 px-4 py-3 text-sm text-rose">
            Unknown widget “{block.widget}”
          </div>
        )
      }
      return (
        <figure className="my-5 rounded-xl border border-line bg-surface/60 p-4">
          <Widget />
          {block.caption && (
            <figcaption className="mt-3 text-center text-xs text-ink-faint">
              <RichText text={block.caption} />
            </figcaption>
          )}
        </figure>
      )
    }
  }
}
