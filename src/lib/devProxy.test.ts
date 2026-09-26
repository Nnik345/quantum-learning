/**
 * The dev-server proxy.
 *
 * Untested until now, and the failure it guards against is silent: the page still loads, so the
 * site looks fine while every feature behind a service returns 403. That only shows up when the
 * site is served on something other than localhost, which is exactly when nobody is watching the
 * terminal — so it is worth pinning down here.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  PROXY_ORIGIN,
  launderOrigin,
  serviceProxy,
  type ProxyEmitter,
  type ProxyRequestHeaders,
} from './devProxy'

/** A stand-in for node-http-proxy's request, recording what the hook sets. */
function fakeRequest() {
  const headers: Record<string, string> = {}
  const request: ProxyRequestHeaders = { setHeader: (n, v) => void (headers[n] = v) }
  return { request, headers }
}

describe('origin rewriting', () => {
  it('presents a proxied request as coming from the loopback origin', () => {
    const { request, headers } = fakeRequest()
    launderOrigin(request)
    expect(headers.origin).toBe('http://localhost:5173')
  })

  it('is wired onto every service proxy', () => {
    const { request, headers } = fakeRequest()
    let hook: ((r: ProxyRequestHeaders) => void) | undefined
    const proxy: ProxyEmitter = { on: (_event, handler) => void (hook = handler) }

    serviceProxy('/ollama', 'http://localhost:11434').configure(proxy)
    expect(hook).toBeDefined()

    hook!(request)
    expect(headers.origin).toBe(PROXY_ORIGIN)
  })

  it('registers specifically on proxyReq, before headers are sent', () => {
    const on = vi.fn()
    serviceProxy('/pyserver', 'http://localhost:8000').configure({ on })
    expect(on).toHaveBeenCalledWith('proxyReq', expect.any(Function))
  })
})

describe('path rewriting', () => {
  it.each([
    ['/ollama', '/ollama/api/tags', '/api/tags'],
    ['/ollama', '/ollama/api/chat', '/api/chat'],
    ['/pyserver', '/pyserver/health', '/health'],
    ['/pyserver', '/pyserver/run', '/run'],
  ])('%s strips its prefix: %s -> %s', (prefix, incoming, expected) => {
    expect(serviceProxy(prefix, 'http://x').rewrite(incoming)).toBe(expected)
  })

  it('leaves a path that does not carry the prefix alone', () => {
    // Defensive: Vite only routes matching paths here, so a mismatch means something is wrong
    // upstream and silently slicing characters off would make it much harder to see.
    expect(serviceProxy('/pyserver', 'http://x').rewrite('/python/grover')).toBe('/python/grover')
  })
})

describe('targets', () => {
  it('keeps changeOrigin so the service sees its own Host', () => {
    expect(serviceProxy('/ollama', 'http://localhost:11434').changeOrigin).toBe(true)
  })

  it('passes the target through unchanged', () => {
    expect(serviceProxy('/pyserver', 'http://gpu-box:8000').target).toBe('http://gpu-box:8000')
  })
})
