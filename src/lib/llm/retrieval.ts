/**
 * Topic-level retrieval over the site's own content.
 *
 * No vector store and no chunking: the entire corpus is roughly 30k tokens and a single topic is
 * 2–4k, so scoring whole topics by term overlap and handing back one or two of them fits the
 * context budget comfortably. If this ever proves too coarse, only this file changes.
 *
 * Grounding answers in the site's own words is the point — it keeps the assistant consistent with
 * the pages a reader has just been looking at, including conventions the model would otherwise get
 * wrong from its training data.
 */

import { TRACKS } from '../../content/registry'
import type { Block, Topic } from '../../content/types'
import { ALGORITHM_PRESETS, type AlgorithmPreset } from '../quantum/presets'
import { getExercise } from '../../content/exercises'

export interface RetrievedTopic {
  trackId: string
  slug: string
  title: string
  score: number
  /** The topic rendered as plain text for the prompt. */
  text: string
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'what', 'when', 'where', 'which', 'why', 'with', 'you', 'your', 'explain', 'tell',
])

/** Words worth matching on, lowercased and stripped of maths and punctuation. */
export function terms(text: string): string[] {
  return text
    .replace(/\$[^$]*\$/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
}

/** Plain-text rendering of a block, for both the index and the prompt. */
function blockText(block: Block): string {
  switch (block.kind) {
    case 'text':
    case 'callout':
      return block.kind === 'callout' && block.title ? `${block.title}: ${block.text}` : block.text
    case 'list':
      return block.items.map((i) => `- ${i}`).join('\n')
    case 'math':
      return `[formula] ${block.tex}${block.caption ? ` (${block.caption})` : ''}`
    case 'circuit':
      return `[worked circuit: preset "${block.preset}"]${block.caption ? ` ${block.caption}` : ''}`
    case 'widget':
      return `[interactive: ${block.widget}]`
    /*
     * The prompt, but never the answer. The tutor should know an exercise is on the page so it can
     * talk the learner through it; handing it the solution would let it give the game away.
     */
    case 'exercise': {
      const exercise = getExercise(block.id)
      return exercise ? `[exercise "${exercise.id}"] ${exercise.prompt}` : ''
    }
  }
}

/** Render a topic for the prompt, headings included so the model can cite sections. */
export function topicToText(topic: Topic): string {
  const parts = [`# ${topic.title}`, topic.blurb, '']
  for (const section of topic.sections) {
    parts.push(`## ${section.title}`)
    if (section.summary) parts.push(`_${section.summary}_`)
    for (const block of section.blocks ?? []) parts.push(blockText(block))
    parts.push('')
  }
  return parts.join('\n').trim()
}

interface IndexEntry {
  trackId: string
  topic: Topic
  /** Term -> weight. Titles and headings count for more than body prose. */
  weights: Map<string, number>
  /** Normalised topic and section headings, for exact phrase matching. */
  phrases: string[]
}

/** Built once at module load; the corpus is static. */
const INDEX: IndexEntry[] = TRACKS.flatMap((track) =>
  track.topics.map((topic) => {
    const weights = new Map<string, number>()
    const add = (text: string, weight: number) => {
      for (const term of terms(text)) weights.set(term, (weights.get(term) ?? 0) + weight)
    }

    add(topic.title, 8)
    add(topic.slug.replace(/-/g, ' '), 8)
    add(topic.blurb, 3)
    for (const section of topic.sections) {
      add(section.title, 4)
      if (section.summary) add(section.summary, 2)
      for (const block of section.blocks ?? []) add(blockText(block), 1)
    }
    const phrases = [topic.title, ...topic.sections.map((sec) => sec.title)]
      .map(normalisePhrase)
      .filter((p) => p.length > 3)

    return { trackId: track.id, topic, weights, phrases }
  }),
)

/**
 * True when one word is a prefix of the other AND they share at least five characters — enough to
 * catch stemming differences without matching unrelated words that merely start alike.
 */
function isMorphologicalMatch(a: string, b: string): boolean {
  const shorter = Math.min(a.length, b.length)
  if (shorter < 5) return false
  return a.startsWith(b) || b.startsWith(a)
}

/** Lowercase, strip maths and punctuation, collapse whitespace. */
function normalisePhrase(text: string): string {
  return text
    .replace(/\$[^$]*\$/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Inverse document frequency per term.
 *
 * Without this, a common word swamps a rare one: "what is phase kickback" scores highest on
 * "Quantum Phase Estimation" purely because "phase" appears everywhere, when kickback is actually
 * explained under Deutsch. Weighting each term by how rare it is fixes that — distinctive words
 * decide the match, common ones barely move it.
 */
const TOTAL_TOPICS = INDEX.length
const IDF: Map<string, number> = (() => {
  const docFreq = new Map<string, number>()
  for (const entry of INDEX) {
    for (const term of entry.weights.keys()) docFreq.set(term, (docFreq.get(term) ?? 0) + 1)
  }
  const idf = new Map<string, number>()
  for (const [term, df] of docFreq) idf.set(term, Math.log(1 + TOTAL_TOPICS / df))
  return idf
})()

const idfFor = (term: string): number => IDF.get(term) ?? Math.log(1 + TOTAL_TOPICS)

export interface SearchOptions {
  limit?: number
  /** Slug of the page the reader is on; it gets a boost so "explain this" works. */
  currentSlug?: string
}

/** Score every topic against a query and return the best few, rendered for the prompt. */
export function searchContent(query: string, options: SearchOptions = {}): RetrievedTopic[] {
  const limit = options.limit ?? 2
  const queryTerms = terms(query)
  const normalisedQuery = normalisePhrase(query)

  const scored = INDEX.map((entry) => {
    let score = 0
    let matchedTerms = 0

    for (const term of queryTerms) {
      const direct = entry.weights.get(term)
      if (direct !== undefined) {
        score += direct * idfFor(term)
        matchedTerms++
        continue
      }
      // Partial credit for morphological near-misses: "entangled" against "entanglement".
      // The shared prefix must be long, or false friends creep in — "pasta" is a prefix-match for
      // "past", which appears in Grover's page, and that alone would make a cookery question look
      // like a hit.
      for (const [indexed, weight] of entry.weights) {
        if (isMorphologicalMatch(term, indexed)) {
          score += weight * idfFor(indexed) * 0.4
          matchedTerms++
          break
        }
      }
    }
    // A heading quoted verbatim in the question is a far stronger signal than any term overlap.
    // "what is phase kickback" names a section of Deutsch's algorithm, even though the word
    // "phase" is more frequent in Phase Estimation.
    let phraseHit = false
    for (const phrase of entry.phrases) {
      if (normalisedQuery.includes(phrase)) {
        score += 15 * phrase.split(' ').length
        phraseHit = true
      }
    }

    const isCurrentPage = Boolean(options.currentSlug && entry.topic.slug === options.currentSlug)
    if (isCurrentPage) score += 25

    /*
     * A single stray word is not a match. "best pasta recipe" hits Grover's blurb on "best" and
     * nothing else; without this, an off-topic question would get a confident-looking answer
     * grounded in an irrelevant page. Require half the meaningful words to land, unless a heading
     * was quoted outright or the reader is asking about the page they are on.
     */
    const coverage = queryTerms.length === 0 ? 0 : matchedTerms / queryTerms.length
    const relevant = phraseHit || isCurrentPage || coverage >= 0.5

    return { entry, score: relevant ? score : 0 }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.topic.slug.localeCompare(b.entry.topic.slug))
    .slice(0, limit)
    .map(({ entry, score }) => ({
      trackId: entry.trackId,
      slug: entry.topic.slug,
      title: entry.topic.title,
      score,
      text: topicToText(entry.topic),
    }))
}

/** Look up one topic directly, for "explain the page I am on". */
export function topicBySlug(slug: string): RetrievedTopic | undefined {
  const entry = INDEX.find((e) => e.topic.slug === slug)
  if (!entry) return undefined
  return {
    trackId: entry.trackId,
    slug: entry.topic.slug,
    title: entry.topic.title,
    score: Infinity,
    text: topicToText(entry.topic),
  }
}

/**
 * Resolve a page by slug or title, tolerantly but not loosely.
 *
 * `open_topic` is a lookup, not a search, so a near-miss must not quietly hand back a different
 * page: "quantum gastronomy" sharing the word "quantum" with a real title is not a match, and
 * answering from the wrong page is worse than admitting there is none. Matching is therefore
 * confined to the name itself — normalised for punctuation, since titles use a typographic
 * apostrophe the model will not reproduce.
 */
export function findTopic(name: string): RetrievedTopic | undefined {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const wanted = norm(name)
  if (!wanted) return undefined

  const candidates = INDEX.map((entry) => ({
    entry,
    slug: norm(entry.topic.slug),
    title: norm(entry.topic.title),
  }))

  const hit =
    candidates.find((c) => c.slug === wanted || c.title === wanted) ??
    // A containment match still has to cover the whole request, not one shared word.
    candidates.find((c) => c.slug.includes(wanted) || c.title.includes(wanted))
  if (!hit) return undefined

  return {
    trackId: hit.entry.trackId,
    slug: hit.entry.topic.slug,
    title: hit.entry.topic.title,
    score: Infinity,
    text: topicToText(hit.entry.topic),
  }
}

/** Every page's path and title, for telling the model what it could have asked for instead. */
export function topicDirectory(): string {
  return INDEX.map((e) => `  /${e.trackId}/${e.topic.slug} — "${e.topic.title}"`).join('\n')
}

/**
 * Which lesson page prints a given circuit, derived by scanning content for its circuit blocks.
 *
 * Built rather than declared so a preset moved to a different page cannot end up citing the wrong
 * one — there is no second list to keep in step.
 */
const PRESET_PAGE: Map<string, { trackId: string; slug: string; title: string }> = (() => {
  const map = new Map<string, { trackId: string; slug: string; title: string }>()
  for (const track of TRACKS) {
    for (const topic of track.topics) {
      for (const section of topic.sections) {
        for (const block of section.blocks ?? []) {
          if (block.kind === 'circuit' && !map.has(block.preset)) {
            map.set(block.preset, { trackId: track.id, slug: topic.slug, title: topic.title })
          }
        }
      }
    }
  }
  return map
})()

/** The page a verified circuit appears on, if any prints it. */
export const presetPage = (presetId: string) => PRESET_PAGE.get(presetId)

export interface RetrievedCircuit {
  preset: AlgorithmPreset
  score: number
  /** Where it is printed, when a lesson prints it. */
  page?: { trackId: string; slug: string; title: string }
}

/** Terms that should surface a circuit: its id, its name, and the page that prints it. */
const CIRCUIT_INDEX = ALGORITHM_PRESETS.map((preset) => {
  const page = PRESET_PAGE.get(preset.id)
  const weights = new Map<string, number>()
  const add = (text: string, weight: number) => {
    for (const term of terms(text)) weights.set(term, (weights.get(term) ?? 0) + weight)
  }
  add(preset.id.replace(/-/g, ' '), 8)
  add(preset.name, 8)
  add(preset.summary, 2)
  if (page) add(page.title, 4)
  // So "show me a teleportation CIRCUIT" scores these above prose.
  add('circuit diagram gates example', 3)
  return { preset, page, weights }
})

/**
 * Verified circuits matching a query.
 *
 * Returned alongside topics rather than instead of them, and capped, so circuit hits can never
 * crowd the lesson text out of the context budget.
 */
export function searchCircuits(query: string, limit = 2): RetrievedCircuit[] {
  const queryTerms = terms(query)
  if (queryTerms.length === 0) return []

  return CIRCUIT_INDEX.map((entry) => {
    let score = 0
    let matched = 0
    for (const term of queryTerms) {
      const direct = entry.weights.get(term)
      if (direct !== undefined) {
        score += direct
        matched++
      }
    }
    // Same coverage rule as topic search: one stray word is not a match.
    return { entry, score: matched / queryTerms.length >= 0.5 ? score : 0 }
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, score }) => ({ preset: entry.preset, page: entry.page, score }))
}

/** Every topic title, cheap enough to always include so the model knows what exists. */
export function contentsOutline(): string {
  return TRACKS.map(
    (track) =>
      `${track.title}: ${track.topics.map((t) => `${t.title} (/${track.id}/${t.slug})`).join('; ')}`,
  ).join('\n')
}
