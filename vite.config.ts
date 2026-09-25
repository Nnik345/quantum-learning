import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Resolved from the config file's own URL so no Node type definitions are needed.
const src = new URL('./src', import.meta.url).pathname

// Declared rather than pulling in @types/node for one lookup.
declare const process: { env: Record<string, string | undefined> }

/**
 * Ollama is proxied rather than called directly.
 *
 * The browser only ever talks to this dev server, so `/ollama/*` is same-origin and there is no
 * CORS configuration to get wrong. It also means an SSH tunnel needs no code change: forward
 * 11434 to the GPU box and the target below still points at localhost.
 */
const ollamaProxy = {
  '/ollama': {
    target: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/ollama/, ''),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': src },
  },
  server: { proxy: ollamaProxy },
  preview: { proxy: ollamaProxy },
})
