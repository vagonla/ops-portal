// All shift processing and saved preferences live in the user's browser.
// No account, database, analytics collector, scheduled job or external API.
const retiredCookies = [
  '__Host-vardiya_session', '__Host-vardiya_oauth_state',
  '__Host-vardiya_oauth_verifier', '__Host-vardiya_oauth_return',
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;
    let response: Response;
    if (path === '/api/health') {
      response = Response.json({ status: 'ok', service: 'ops-portal' });
    } else if (path.startsWith('/api/')) {
      response = Response.json({ error: 'Bu özellik kullanımdan kaldırıldı.' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
    } else if (path === '/admin' || path.startsWith('/admin/')) {
      response = new Response('Sayfa bulunamadı.', { status: 404 });
    } else {
      response = await env.ASSETS.fetch(request);
    }
    const cookie = request.headers.get('Cookie') || '';
    const expired = retiredCookies.filter(name => cookie.split(';').some(part => part.trim().startsWith(`${name}=`)));
    if (expired.length) {
      response = new Response(response.body, response);
      for (const name of expired) response.headers.append('Set-Cookie', `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
