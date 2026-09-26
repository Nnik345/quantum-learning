/**
 * Choosing which model answers.
 *
 * The list is built from what the daemon actually has pulled, so the picker cannot offer something
 * that would fail to load — that property, and the recovery when a remembered model disappears, are
 * what these cover. The rest is remembering the choice; the picker itself is covered in
 * assistant.test.tsx, against the panel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

import { MODEL_KEY, formatSize, useModelChoice } from './useModelChoice'
import { DEFAULT_MODEL } from '../lib/llm/client'

/** Answer /api/tags with a given set of pulled models. */
function stubTags(models: { name: string; size: number }[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: models.map((m) => ({
          name: m.name,
          size: m.size,
          details: { parameter_size: '9.7B', quantization_level: 'Q4_K_M' },
        })),
      }),
    })),
  )
}

const THREE = [
  { name: 'qwen3.5:9b', size: 6_600_000_000 },
  { name: 'qwen3.5:2b', size: 2_700_000_000 },
  { name: 'qwen3.5:9b-q8_0', size: 10_700_000_000 },
]

beforeEach(() => window.localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('the model list', () => {
  it('comes from the daemon, smallest first', async () => {
    stubTags(THREE)
    const { result } = renderHook(() => useModelChoice())

    await waitFor(() => expect(result.current.available).toHaveLength(3))
    expect(result.current.available.map((m) => m.name)).toEqual([
      'qwen3.5:2b',
      'qwen3.5:9b',
      'qwen3.5:9b-q8_0',
    ])
  })

  it('starts on the configured default', async () => {
    stubTags(THREE)
    const { result } = renderHook(() => useModelChoice())
    await waitFor(() => expect(result.current.available.length).toBeGreaterThan(0))
    expect(result.current.model).toBe(DEFAULT_MODEL)
  })

  it('is empty rather than throwing when the daemon is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const { result } = renderHook(() => useModelChoice())
    await waitFor(() => expect(result.current.available).toEqual([]))
    // Still usable: the default is what gets asked for.
    expect(result.current.model).toBe(DEFAULT_MODEL)
  })
})

describe('remembering the choice', () => {
  it('persists a selection and reads it back', async () => {
    stubTags(THREE)
    const first = renderHook(() => useModelChoice())
    await waitFor(() => expect(first.result.current.available.length).toBe(3))
    act(() => first.result.current.choose('qwen3.5:2b'))
    expect(window.localStorage.getItem(MODEL_KEY)).toBe('qwen3.5:2b')

    const second = renderHook(() => useModelChoice())
    await waitFor(() => expect(second.result.current.model).toBe('qwen3.5:2b'))
  })

  it('falls back to the default when a remembered model is gone', async () => {
    // Someone ran `ollama rm`, or the site is pointed at a different machine.
    window.localStorage.setItem(MODEL_KEY, 'qwen3.5:35b')
    stubTags(THREE)
    const { result } = renderHook(() => useModelChoice())

    await waitFor(() => expect(result.current.available.length).toBe(3))
    // Without this the reader would hit "not pulled" on every request with no idea why.
    await waitFor(() => expect(result.current.model).toBe(DEFAULT_MODEL))
  })

  it('flags a switch so the UI can warn about the reload', async () => {
    stubTags(THREE)
    const { result } = renderHook(() => useModelChoice())
    await waitFor(() => expect(result.current.available.length).toBe(3))

    expect(result.current.switching).toBe(false)
    act(() => result.current.choose('qwen3.5:9b-q8_0'))
    expect(result.current.switching).toBe(true)
    act(() => result.current.settled())
    expect(result.current.switching).toBe(false)
  })
})

describe('formatSize', () => {
  it('reports the number that decides whether a model fits the card', () => {
    expect(formatSize(6_600_000_000)).toBe('6.6 GB')
    expect(formatSize(10_700_000_000)).toBe('10.7 GB')
  })

  it('says nothing when the daemon reported no size', () => {
    expect(formatSize(0)).toBe('')
  })
})
