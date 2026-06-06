import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../lib/session';

export const POST: APIRoute = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/top',
      'Set-Cookie': clearSessionCookie(),
    },
  });
};
