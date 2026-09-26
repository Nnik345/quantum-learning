import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { serviceProxy } from './src/lib/devProxy'

// Resolved from the config file's own URL so no Node type definitions are needed.
const src = new URL('./src', import.meta.url).pathname

// Declared rather than pulling in @types/node for one lookup.
declare const process: { env: Record<string, string | undefined> }

/**
 * Both local services are proxied rather than called directly.
 *
 * The browser only ever talks to this dev server, so `/ollama/*` and `/pyserver/*` are same-origin
 * and there is no CORS configuration to get wrong. It also means a tunnel needs no code change:
 * forward the port to whichever box runs the service and the targets below still say localhost.
 *
 * Note that `localhost` here is resolved by THIS process, so it means the machine Vite runs on —
 * not the machine the browser is on.
 *
 * `serviceProxy` also rewrites the outgoing Origin header; see src/lib/devProxy.ts for why that is
 * what makes the site work when it is served on anything other than localhost.
 */
const proxy = {
  '/ollama': serviceProxy('/ollama', process.env.OLLAMA_URL ?? 'http://localhost:11434'),
  /*
   * Named `/pyserver` rather than `/py` deliberately: Vite matches proxies by PREFIX, so a `/py`
   * rule also swallows the `/python` page route and serves a 502 instead of the app.
   */
  '/pyserver': serviceProxy('/pyserver', process.env.PY_URL ?? 'http://localhost:8000'),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': src },
  },
  server: { proxy },
  preview: { proxy },
})
