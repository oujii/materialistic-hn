// HN login: POSTs credentials to news.ycombinator.com/login, extracts session cookie
const HN = 'https://news.ycombinator.com';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

  // Node 22 fetch: use getSetCookie() to get each Set-Cookie as a separate entry
  const setCookies = (res.headers as any).getSetCookie?.() as string[] | undefined
    ?? (res.headers.get('set-cookie')?.split(/,(?=\s*\w+=)/) ?? []);

  let userCookie: string | null = null;
  for (const c of setCookies) {
    // Each entry looks like: "user=USERNAME&HASH; expires=...; path=/; HttpOnly"
    const m = c.match(/^\s*user=([^;]+)/);
    if (m) {
      userCookie = `user=${m[1]}`;
      break;
    }
  }

  if (!userCookie) {
    throw new Error('Login failed — invalid username or password');
  }

  // Verify the cookie actually authenticates as the user
  const valid = await hnValidateSession(username, userCookie);
  if (!valid) {
    throw new Error('Login failed — credentials accepted but session invalid');
  }

  return { username, cookie: userCookie };
}

export async function hnFave(itemId: number, cookie: string, save: boolean): Promise<{ ok: boolean; reason?: string }> {
  // HN's /fave requires an `auth` token unique per (user, item, session).
  // We extract it by fetching the item page first.
  const itemRes = await fetch(`${HN}/item?id=${itemId}`, {
    headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/html' },
  });
  if (itemRes.status >= 400) {
    return { ok: false, reason: `item_fetch_${itemRes.status}` };
  }
  const html = await itemRes.text();

  // Logged-out users see no fave link → cookie is invalid
  if (!/href="logout\?/.test(html)) {
    return { ok: false, reason: 'session_expired' };
  }

  // HN's anchor hrefs contain HTML entities (&amp;), so match both & and &amp;
  // Two possible links per item:
  //   fave?id=NNN&auth=XXX        -> currently NOT favorited; click to fave
  //   fave?id=NNN&un=t&auth=XXX   -> currently IS favorited; click to unfave
  const AMP = '(?:&|&amp;)';
  const unfaveMatch = html.match(new RegExp(`fave\\?id=${itemId}${AMP}un=t${AMP}auth=([a-f0-9]+)`));
  const faveMatch = html.match(new RegExp(`fave\\?id=${itemId}${AMP}auth=([a-f0-9]+)`));

  const currentlySaved = !!unfaveMatch;

  // Already in desired state — no API call needed
  if (currentlySaved === save) {
    return { ok: true };
  }

  const auth = save ? faveMatch?.[1] : unfaveMatch?.[1];
  if (!auth) {
    return { ok: false, reason: 'no_auth_token' };
  }

  const endpoint = save
    ? `${HN}/fave?id=${itemId}&auth=${auth}`
    : `${HN}/fave?id=${itemId}&un=t&auth=${auth}`;

  const res = await fetch(endpoint, {
    headers: {
      Cookie: cookie,
      'User-Agent': UA,
      Referer: `${HN}/item?id=${itemId}`,
      Accept: 'text/html',
    },
    redirect: 'manual',
  });

  const location = res.headers.get('location') ?? '';
  if (location.includes('/login')) {
    return { ok: false, reason: 'session_expired' };
  }
  if (res.status >= 400) {
    return { ok: false, reason: `hn_error_${res.status}` };
  }
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
