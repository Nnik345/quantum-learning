/**
 * Content model for the Maths and Theory tracks.
 *
 * Topics are plain data, not JSX, so adding a section is adding an object to an array and
 * reordering is moving a line. Navigation, sidebars, prev/next links and anchors are all derived
 * from this — nothing about page structure is written by hand twice.
 *
 * Text blocks support LaTeX inline with $...$ and as a display block with $$...$$.
 */

/** Keys registered in `widgets.tsx`. Adding a widget there makes it usable from any section. */
export type WidgetKey = 'bloch-sphere' | 'argand-plane' | 'matrix-playground' | 'circuit-teaser'

export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'math'; tex: string; caption?: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'callout'; tone?: 'note' | 'tip' | 'warn'; title?: string; text: string }
  | { kind: 'widget'; widget: WidgetKey; caption?: string }
  /** A worked circuit, by preset id from lib/quantum/presets.ts. Renders read-only with a
   *  link that loads it into the Circuit Lab. */
  | { kind: 'circuit'; preset: string; caption?: string }

export type SectionStatus = 'placeholder' | 'draft' | 'done'

export interface Section {
  /** URL anchor. Keep stable once shared. */
  id: string
  title: string
  /** One line shown under the heading and in the sidebar tooltip. */
  summary?: string
  /** Defaults to 'placeholder' when `blocks` is absent. */
  status?: SectionStatus
  blocks?: Block[]
}

export interface Topic {
  slug: string
  title: string
  blurb: string
  /** Rough reading time, shown on index cards. Optional. */
  estMinutes?: number
  sections: Section[]
}

export interface Track {
  /** URL segment: /math, /theory or /algorithms. */
  id: 'math' | 'theory' | 'algorithms'
  title: string
  blurb: string
  topics: Topic[]
}

export const sectionStatus = (s: Section): SectionStatus =>
  s.status ?? (s.blocks && s.blocks.length > 0 ? 'done' : 'placeholder')

/**
 * How many of a topic's sections have been written.
 *
 * This measures AUTHORING, not reading — it was what drove the pips on the index cards while
 * content was still being drafted. Every topic is written now, so it reports complete everywhere;
 * learner progress is a separate thing entirely, in src/learning/useProgress.ts. Kept because it
 * still earns its place the moment a new stub topic is added.
 */
export function authoredSections(topic: Topic): { done: number; total: number } {
  const done = topic.sections.filter((s) => sectionStatus(s) !== 'placeholder').length
  return { done, total: topic.sections.length }
}
