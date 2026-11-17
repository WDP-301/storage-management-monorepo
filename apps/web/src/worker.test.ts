import { describe, expect, it, vi } from 'vitest';
import worker from './worker';

describe('Cloudflare worker proxy', () => {
  it('fails closed with 503 when VITE_PROXY_TARGET is unset or invalid', async () => {
    const assets = { fetch: vi.fn() };
    const req = new Request('https://app.example/api/v1/health');

    const res = await worker.fetch(req, { ASSETS: assets });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: 'API proxy target is not configured' });
    expect(assets.fetch).not.toHaveBeenCalled();

    const invalidRes = await worker.fetch(req, {
      ASSETS: assets,
      VITE_PROXY_TARGET: 'ftp://invalid.example',
    });
    expect(invalidRes.status).toBe(503);
  });

  it('forwards /api/ requests to VITE_PROXY_TARGET, sets host, and strips hop-by-hop headers', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const req = new Request('https://app.example/api/v1/bookings?page=1', {
      method: 'GET',
      headers: {
        cookie: 'sid=abc',
        'x-forwarded-for': '1.2.3.4',
        connection: 'keep-alive',
      },
    });

    const res = await worker.fetch(req, {
      ASSETS: { fetch: vi.fn() },
      VITE_PROXY_TARGET: 'https://api.example.com',
    });

    expect(res.status).toBe(200);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.example.com/api/v1/bookings?page=1');
    const forwardedHeaders = init.headers as Headers;
    expect(forwardedHeaders.get('host')).toBe('api.example.com');
    expect(forwardedHeaders.get('cookie')).toBe('sid=abc');
    expect(forwardedHeaders.get('x-forwarded-for')).toBeNull();
    expect(forwardedHeaders.get('connection')).toBeNull();
    fetchSpy.mockRestore();
  });

  it('delegates non-API requests to static ASSETS', async () => {
    const assetResponse = new Response('<html></html>');
    const assets = { fetch: vi.fn().mockResolvedValue(assetResponse) };
    const req = new Request('https://app.example/contracts');

    await expect(worker.fetch(req, { ASSETS: assets })).resolves.toBe(assetResponse);
    expect(assets.fetch).toHaveBeenCalledWith(req);
  });
});
