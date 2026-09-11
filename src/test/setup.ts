/**
 * Test setup.
 *
 * Node 22+ defines its own experimental `localStorage` global, which is `undefined` unless the
 * process was started with `--localstorage-file`. Vitest copies Node's globals onto the jsdom
 * window, so that undefined getter shadows the working one jsdom provides. Rather than pass a
 * CLI flag, install a plain in-memory Storage when the real one is missing — the behaviour the
 * code under test expects, and untouched in a real browser.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// With `globals: false` Testing Library cannot register its own afterEach hook, so without this
// every render would pile up in the same document and queries would match across tests.
afterEach(cleanup)

// jsdom has no IntersectionObserver; the topic sidebar uses one to highlight the section in view.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class NoopObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: readonly number[] = []
    disconnect(): void {}
    observe(): void {}
    unobserve(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }
  globalThis.IntersectionObserver = NoopObserver as unknown as typeof IntersectionObserver
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }
  clear(): void {
    this.data.clear()
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value))
  }
}

if (typeof window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: false,
  })
}
