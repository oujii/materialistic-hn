import type { APIRoute } from 'astro';
import { getSession } from '../../lib/session';
import { hnFave } from '../../lib/hn-auth';

export const POST: APIRoute = async ({ request }) => {
  const session = await getSession(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Not logged in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let id: number;
  let unsave = false;
  try {
    const body = await request.json();
    id = parseInt(body.id);
    unsave = body.unsave === true;
  } catch {
    return new Response(JSON.stringify({ error: 'Bad request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await hnFave(id, session.cookie, !unsave);
    if (!result.ok) {
      if (result.reason === 'session_expired') {
        return new Response(JSON.stringify({ error: 'session_expired' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Save failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true, saved: !unsave }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Save failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
