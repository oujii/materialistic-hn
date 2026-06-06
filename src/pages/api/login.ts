import type { APIRoute } from 'astro';
import { hnLogin } from '../../lib/hn-auth';
import { createSessionCookie } from '../../lib/session';

export const POST: APIRoute = async ({ request }) => {
  let username = '';
  let password = '';

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await request.formData();
    username = (body.get('username') as string ?? '').trim();
    password = (body.get('password') as string ?? '').trim();
  } else {
    const body = await request.json();
    username = body.username?.trim() ?? '';
    password = body.password?.trim() ?? '';
  }

  if (!username || !password) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login?error=invalid' },
    });
  }

  try {
    const session = await hnLogin(username, password);
    const cookie = await createSessionCookie(session);
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/top',
        'Set-Cookie': cookie,
      },
    });
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login?error=invalid' },
    });
  }
};
