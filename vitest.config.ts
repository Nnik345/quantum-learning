/**
 * Test config is kept separate from vite.config.ts on purpose: Vitest 2 bundles its own copy of
 * Vite, and mixing the two `defineConfig` types in one file produces a wall of type conflicts.
 *
 * The React plugin is needed for the .test.tsx suites, and jsdom for the components that touch
 * localStorage. The pure simulator tests are environment-agnostic, so one environment for
 * everything keeps the config honest — the whole suite still runs in well under a second.
 */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    globals: false,
  },
})
