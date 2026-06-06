// HN login: POSTs credentials to news.ycombinator.com/login, extracts session cookie
const HN = 'https://news.ycombinator.com';
const UA = 'Mozilla/5.0 (compatible; Materialistic/1.0; +https://materialistic-hn.netlify.app)';

export interface HNSession {
  username: string;
  cookie: string; // raw "user=..." cookie value
}

export async function hnLogin(username: string, password: string): Promise<HNSession> {
  const body = new URLSearchParams({
    acct: username,
    pw: password,
    goto: 'news',
  });

  const res = await fetch(`${HN}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: body.toString(),
    redirect: 'manual',
  });

  // On successful login HN sets a "user" cookie and redirects (302) to /news.
  // On failure it returns 200 with "Bad login" in body.
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/user=([^;]+)/);
  if (!match) {
    throw new Error('Login failed — invalid username or password');
  }

  return { username, cookie: `user=${match[1]}` };
}

export async function hnFave(itemId: number, cookie: string, save: boolean): Promise<{ ok: boolean; reason?: string }> {
  const endpoint = save ? `${HN}/fave?id=${itemId}` : `${HN}/fave?id=${itemId}&un=t`;
  const res = await fetch(endpoint, {
    headers: {
      Cookie: cookie,
      'User-Agent': UA,
    },
    redirect: 'manual',
  });

  // HN redirects to /login if cookie is invalid — that means our session expired
  const location = res.headers.get('location') ?? '';
  if (location.includes('/login')) {
    return { ok: false, reason: 'session_expired' };
  }
  // Otherwise HN normally 302s back to the item or /favorites
  return { ok: true };
}

// Validate that a session cookie actually belongs to the claimed user
export async function hnValidateSession(username: string, cookie: string): Promise<boolean> {
  const res = await fetch(`${HN}/threads?id=${username}`, {
    headers: { Cookie: cookie, 'User-Agent': UA },
    redirect: 'manual',
  });
  const location = res.headers.get('location') ?? '';
  if (location.includes('/login')) return false;
  const html = await res.text();
  // HN shows "logout" link in top bar for authenticated users
  return html.includes('logout?');
}

export async function hnVote(itemId: number, cookie: string, dir: 'up' | 'un'): Promise<void> {
  // HN /vote requires an auth token tied to the page render. Real upvote support requires
  // fetching the item page first, extracting the auth from the vote link, then POSTing.
  // This is a placeholder; the listing/item page rendering should call hnGetVoteAuth first.
  void itemId; void cookie; void dir;
}
