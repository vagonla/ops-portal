import { describe, expect, it, vi } from 'vitest';
import worker from '../worker';

const fixture = () => ({ ASSETS: { fetch: vi.fn(async () => new Response('static app')) } }) as unknown as Env;
describe('stateless application host', () => {
  it('serves the application without a database or user account', async () => {
    const env = fixture();
    const response = await worker.fetch(new Request('https://example.com/'), env);
    expect(await response.text()).toBe('static app');
    expect(response.headers.has('Set-Cookie')).toBe(false);
  });
  it.each(['/api/me', '/api/auth/login', '/api/auth/callback', '/api/social', '/api/shifts/current', '/api/analytics/events', '/api/admin/analytics/report'])('retires %s instead of calling the previous service', async path => {
    const env = fixture();
    const response = await worker.fetch(new Request(`https://example.com${path}`), env);
    expect(response.status).toBe(410);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(env.ASSETS.fetch).not.toHaveBeenCalled();
  });
  it('removes the former admin page', async () => {
    expect((await worker.fetch(new Request('https://example.com/admin/analytics'), fixture())).status).toBe(404);
  });
  it('expires a previously signed-in browser session without caching the response', async () => {
    const response = await worker.fetch(new Request('https://example.com/', { headers: { Cookie: '__Host-vardiya_session=old; __Host-vardiya_oauth_state=old' } }), fixture());
    expect(response.headers.get('Set-Cookie')).toContain('__Host-vardiya_session=;');
    expect(response.headers.get('Set-Cookie')).toContain('__Host-vardiya_oauth_state=;');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).toBe('static app');
  });
});
