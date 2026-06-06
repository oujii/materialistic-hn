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

export async function hnFave(itemId: number, cookie: string, save: boolean): Promise<void> {
  const endpoint = save ? `${HN}/fave?id=${itemId}` : `${HN}/fave?id=${itemId}&un=t`;
  await fetch(endpoint, {
    headers: {
      Cookie: cookie,
      'User-Agent': UA,
    },
    redirect: 'manual',
  });
}

export async function hnVote(itemId: number, cookie: string, dir: 'up' | 'un'): Promise<void> {
  // HN /vote requires an auth token tied to the page render. Real upvote support requires
  // fetching the item page first, extracting the auth from the vote link, then POSTing.
  // This is a placeholder; the listing/item page rendering should call hnGetVoteAuth first.
  void itemId; void cookie; void dir;
}
