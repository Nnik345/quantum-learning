/**
 * The single source of truth for the Maths and Theory tracks.
 *
 * Every index page, sidebar, breadcrumb and prev/next link is derived from here, so reordering a
 * topic or renaming a track is a one-line change.
 */

import type { Topic, Track } from './types'
import { MATH_TOPICS } from './math'
import { THEORY_TOPICS } from './theory'
import { ALGORITHM_TOPICS } from './algorithms'

export const TRACKS: Track[] = [
  {
    id: 'math',
    title: 'Basic Maths',
    blurb:
      'The mathematical groundwork: complex numbers, linear algebra, and the probability you need to read results.',
    topics: MATH_TOPICS,
  },
  {
    id: 'theory',
    title: 'Basic Theory',
    blurb:
      'Dirac notation, the Bloch sphere, gates, tensor products, entanglement and measurement.',
    topics: THEORY_TOPICS,
  },
  {
    id: 'algorithms',
    title: 'Algorithms',
    blurb:
      'Twelve algorithms in teaching order, each introducing one new mechanism and building only on the ones before it. Every page carries a working circuit you can open and run.',
    topics: ALGORITHM_TOPICS,
  },
]

export const getTrack = (id: string): Track | undefined => TRACKS.find((t) => t.id === id)

export const getTopic = (trackId: string, slug: string): Topic | undefined =>
  getTrack(trackId)?.topics.find((t) => t.slug === slug)

export interface Neighbours {
  previous?: { topic: Topic; trackId: string }
  next?: { topic: Topic; trackId: string }
}

/** Previous/next within a track, so a reader can move straight through it. */
export function neighbours(trackId: string, slug: string): Neighbours {
  const track = getTrack(trackId)
  if (!track) return {}
  const i = track.topics.findIndex((t) => t.slug === slug)
  if (i === -1) return {}
  return {
    previous: i > 0 ? { topic: track.topics[i - 1], trackId } : undefined,
    next: i < track.topics.length - 1 ? { topic: track.topics[i + 1], trackId } : undefined,
  }
}
