/**
 * Integrity checks over all written content.
 *
 * The maths is the part most likely to break silently: a single backslash in a TypeScript string
 * is an invalid escape that JavaScript quietly drops, turning `\langle` into `langle` and
 * rendering garbage. Every formula is therefore compiled by KaTeX here, so a typo fails the build
 * rather than reaching a reader.
 */

import { describe, it, expect } from 'vitest'
import katex from 'katex'

import { TRACKS } from './registry'
import { sectionStatus, type Block, type Topic } from './types'
import { getPreset } from '../lib/quantum/presets'
import { WIDGETS } from './widgets'

const allTopics: { trackId: string; topic: Topic }[] = TRACKS.flatMap((t) =>
  t.topics.map((topic) => ({ trackId: t.id, topic })),
)

const allBlocks: { where: string; block: Block }[] = allTopics.flatMap(({ trackId, topic }) =>
  topic.sections.flatMap((section) =>
    (section.blocks ?? []).map((block) => ({
      where: `${trackId}/${topic.slug}#${section.id}`,
      block,
    })),
  ),
)

/** Compile one LaTeX fragment, returning an error message or undefined. */
function texError(tex: string): string | undefined {
  try {
    katex.renderToString(tex, { throwOnError: true, displayMode: false })
    return undefined
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

/** Pull every $...$ and $$...$$ fragment out of a prose string. */
function inlineTex(text: string): string[] {
  const out: string[] = []
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) out.push(m[1] ?? m[2])
  return out
}

describe('content structure', () => {
  it('has three tracks with unique topic slugs', () => {
    expect(TRACKS.map((t) => t.id)).toEqual(['math', 'theory', 'algorithms'])
    for (const track of TRACKS) {
      const slugs = track.topics.map((t) => t.slug)
      expect(`${track.id}: ${new Set(slugs).size}`).toBe(`${track.id}: ${slugs.length}`)
    }
  })

  it('gives every section a unique anchor within its topic', () => {
    for (const { topic } of allTopics) {
      const ids = topic.sections.map((s) => s.id)
      expect(`${topic.slug}: ${new Set(ids).size}`).toBe(`${topic.slug}: ${ids.length}`)
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('uses URL-safe slugs everywhere', () => {
    for (const { topic } of allTopics) expect(topic.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('gives every topic a title and blurb', () => {
    for (const { topic } of allTopics) {
      expect(topic.title.length).toBeGreaterThan(0)
      expect(topic.blurb.length).toBeGreaterThan(0)
      expect(topic.sections.length).toBeGreaterThan(0)
    }
  })
})

describe('every formula compiles', () => {
  it('display maths', () => {
    const failures = allBlocks
      .filter((b) => b.block.kind === 'math')
      .map(({ where, block }) => {
        const error = texError((block as Extract<Block, { kind: 'math' }>).tex)
        return error ? `${where}: ${error}` : undefined
      })
      .filter(Boolean)
    expect(failures).toEqual([])
  })

  it('inline maths inside prose, lists and callouts', () => {
    const failures: string[] = []

    const check = (where: string, text: string) => {
      for (const tex of inlineTex(text)) {
        const error = texError(tex)
        if (error) failures.push(`${where}: "${tex}" — ${error}`)
      }
    }

    for (const { where, block } of allBlocks) {
      if (block.kind === 'text') check(where, block.text)
      if (block.kind === 'callout') check(where, block.text)
      if (block.kind === 'list') block.items.forEach((i) => check(where, i))
      if (block.kind === 'math' && block.caption) check(where, block.caption)
      if (block.kind === 'circuit' && block.caption) check(where, block.caption)
      if (block.kind === 'widget' && block.caption) check(where, block.caption)
    }

    for (const { topic } of allTopics) {
      check(`${topic.slug} blurb`, topic.blurb)
      for (const s of topic.sections) {
        check(`${topic.slug}#${s.id} title`, s.title)
        if (s.summary) check(`${topic.slug}#${s.id} summary`, s.summary)
      }
    }

    expect(failures).toEqual([])
  })

  it('has no stray backslash escapes that JavaScript would have eaten', () => {
    // A LaTeX command whose backslash vanished leaves a bare word like "langle" behind. This is
    // checked only INSIDE maths — in prose, "dagger" and "alpha" are ordinary English.
    const suspects = /(?<![\\A-Za-z])(langle|rangle|frac|sqrt|otimes|dagger|psi|alpha|beta|theta|varphi|cdot|begin|end)(?![A-Za-z])/
    const failures: string[] = []

    const checkTex = (where: string, tex: string) => {
      const hit = suspects.exec(tex)
      if (hit) failures.push(`${where}: bare "${hit[1]}" in maths — lost its backslash?`)
    }

    for (const { where, block } of allBlocks) {
      if (block.kind === 'math') checkTex(where, block.tex)
      const prose: string[] = []
      if (block.kind === 'text' || block.kind === 'callout') prose.push(block.text)
      if (block.kind === 'list') prose.push(...block.items)
      for (const t of prose) inlineTex(t).forEach((tex) => checkTex(where, tex))
    }

    expect(failures).toEqual([])
  })
})

describe('every reference resolves', () => {
  it('circuit blocks name a real preset', () => {
    const failures = allBlocks
      .filter((b) => b.block.kind === 'circuit')
      .map(({ where, block }) => {
        const id = (block as Extract<Block, { kind: 'circuit' }>).preset
        return getPreset(id) ? undefined : `${where}: unknown preset "${id}"`
      })
      .filter(Boolean)
    expect(failures).toEqual([])
  })

  it('widget blocks name a registered widget', () => {
    const failures = allBlocks
      .filter((b) => b.block.kind === 'widget')
      .map(({ where, block }) => {
        const key = (block as Extract<Block, { kind: 'widget' }>).widget
        return WIDGETS[key] ? undefined : `${where}: unknown widget "${key}"`
      })
      .filter(Boolean)
    expect(failures).toEqual([])
  })
})

describe('written coverage', () => {
  it('has no unwritten sections left in the theory track', () => {
    const track = TRACKS.find((t) => t.id === 'theory')!
    const stubs = track.topics.flatMap((topic) =>
      topic.sections.filter((s) => sectionStatus(s) === 'placeholder').map((s) => `${topic.slug}#${s.id}`),
    )
    expect(stubs).toEqual([])
  })

  it('has no unwritten sections left in the algorithms track', () => {
    const track = TRACKS.find((t) => t.id === 'algorithms')!
    const stubs = track.topics.flatMap((topic) =>
      topic.sections.filter((s) => sectionStatus(s) === 'placeholder').map((s) => `${topic.slug}#${s.id}`),
    )
    expect(stubs).toEqual([])
  })

  it('covers all twelve algorithms, each with a runnable circuit', () => {
    const track = TRACKS.find((t) => t.id === 'algorithms')!
    expect(track.topics).toHaveLength(12)

    for (const topic of track.topics) {
      const hasCircuit = topic.sections.some((s) =>
        (s.blocks ?? []).some((b) => b.kind === 'circuit'),
      )
      expect(`${topic.slug} has a circuit: ${hasCircuit}`).toBe(`${topic.slug} has a circuit: true`)
    }
  })
})
