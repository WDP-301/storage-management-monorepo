export interface Env {
  ASSETS: { fetch: typeof fetch };
  VITE_PROXY_TARGET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Forward API requests to the upstream backend
    if (url.pathname.startsWith('/api/')) {
      const backendUrl =
        env.VITE_PROXY_TARGET || 'https://storage-management-monorepo.onrender.com';
      const targetUrl = new URL(url.pathname + url.search, backendUrl);

      const headers = new Headers(request.headers);
      headers.set('host', new URL(backendUrl).host);

      return fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      });
    }

    // Fallback to static assets (SPA)
    return env.ASSETS.fetch(request);
  },
};
