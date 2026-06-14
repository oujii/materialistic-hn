import type { APIRoute } from 'astro';
import { getSession } from '../../lib/session';
import { fetchFavoriteIds } from '../../lib/hn-scrape';

export const GET: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session) {
    return new Response(JSON.stringify({ ids: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }
  try {
    const idSet = await fetchFavoriteIds(session.username, session.cookie);
    return new Response(JSON.stringify({ ids: Array.from(idSet) }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Browser may keep this around briefly; the client also caches in sessionStorage
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch {
    return new Response(JSON.stringify({ ids: [], error: 'scrape_failed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  }
};
