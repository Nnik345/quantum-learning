/**
 * How the dev server proxies the two local services.
 *
 * The browser only ever talks to Vite; `/ollama` and `/pyserver` are forwarded from here. That
 * matters for more than CORS: both services guard themselves with an Origin allowlist, and neither
 * knows about whatever address the site is being served from.
 *
 * Serve the site on a LAN or tailnet address and the browser sends that address as `Origin`. Ollama
 * answers 403 (its own CSRF protection) and pyserver answers 403 (its own allowlist), while the page
 * itself loads fine — so the site appears to work and every feature behind a service quietly fails.
 *
 * So the Origin is rewritten to the loopback origin on the way out. A request only reaches this hook
 * by arriving at the dev server in the first place, which is exactly what those allowlists are
 * trying to establish, and it means the address the site is shared on never has to be configured
 * anywhere.
 *
 * This does NOT weaken the services' own checks. A page that hits `localhost:8000` directly still
 * carries its own Origin and is still refused; the proxy is not in that path. What it does mean is
 * that anyone who can reach the dev server can reach both services through it, so the dev server's
 * binding — and, when sharing, the tailnet ACL and the Python sandbox — are the real boundary.
 */

/** The origin both services are configured to trust out of the box. */
export const PROXY_ORIGIN = 'http://localhost:5173'

/** The slice of node-http-proxy's request object this needs. Typed locally to avoid @types/node. */
export interface ProxyRequestHeaders {
  setHeader(name: string, value: string): void
}

export interface ProxyEmitter {
  on(event: 'proxyReq', handler: (request: ProxyRequestHeaders) => void): void
}

/** Present every proxied request to the service as though it came from the loopback origin. */
export const launderOrigin = (request: ProxyRequestHeaders): void =>
  request.setHeader('origin', PROXY_ORIGIN)

/**
 * Proxy options for one local service.
 *
 * `prefix` is stripped from the path, so `/ollama/api/tags` reaches the service as `/api/tags`.
 */
export function serviceProxy(prefix: string, target: string) {
  return {
    target,
    changeOrigin: true,
    rewrite: (path: string) => (path.startsWith(prefix) ? path.slice(prefix.length) : path),
    configure: (proxy: ProxyEmitter) => proxy.on('proxyReq', launderOrigin),
  }
}
