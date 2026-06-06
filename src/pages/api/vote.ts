import type { APIRoute } from 'astro';
import { getSession } from '../../lib/session';
import { hnVote } from '../../lib/hn-auth';

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not logged in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let id: number;
  let dir: 'up' | 'un' = 'up';
  try {
    const body = await request.json();
    id = parseInt(body.id);
    dir = body.dir === 'un' ? 'un' : 'up';
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    await hnVote(id, session.cookie, dir);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Vote failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
