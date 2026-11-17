export interface Env {
  ASSETS: { fetch: typeof fetch };
  VITE_PROXY_TARGET?: string;
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'x-forwarded-host',
  'x-forwarded-for',
]);

function resolveProxyTarget(raw?: string): URL | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Forward API requests to the configured upstream backend (fail closed if unset)
    if (url.pathname.startsWith('/api/')) {
      const upstream = resolveProxyTarget(env.VITE_PROXY_TARGET);
      if (!upstream) {
        return new Response(JSON.stringify({ message: 'API proxy target is not configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const targetUrl = new URL(url.pathname + url.search, upstream);
      const headers = new Headers();
      request.headers.forEach((value, key) => {
        if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
          headers.set(key, value);
        }
      });
      headers.set('host', upstream.host);

      const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

      return fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        redirect: 'manual',
      });
    }

    // Fallback to static assets (SPA)
    return env.ASSETS.fetch(request);
  },
};
