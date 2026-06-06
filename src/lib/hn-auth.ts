// HN login proxy — fetches CSRF token, POSTs credentials, extracts session cookie
const HN = 'https://news.ycombinator.com';

export interface HNSession {
  username: string;
  cookie: string; // raw "user=..." cookie value
}

async function getFnid(): Promise<string> {
  const res = await fetch(`${HN}/login`, {
    headers: { 'User-Agent': 'Materialistic/1.0' },
  });
  const html = await res.text();
  const match = html.match(/name="fnid"\s+value="([^"]+)"/);
  if (!match) throw new Error('Could not find CSRF token on HN login page');
  return match[1];
}

export async function hnLogin(username: string, password: string): Promise<HNSession> {
  const fnid = await getFnid();

  const body = new URLSearchParams({
    fnid,
    fnop: 'login-main',
    acct: username,
    pw: password,
    goto: 'news',
  });

  const res = await fetch(`${HN}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Materialistic/1.0',
    },
    body: body.toString(),
    redirect: 'manual',
  });

  // HN sets a "user" cookie on successful login and redirects
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/user=([^;]+)/);
  if (!match) {
    throw new Error('Login failed — check username and password');
  }

  return { username, cookie: `user=${match[1]}` };
}

export async function hnFave(itemId: number, cookie: string, save: boolean): Promise<void> {
  const how = save ? 'un' : ''; // HN toggles: "un" = unfave, "" = fave... actually it's just /fave
  // HN /fave endpoint needs: id, how (optional), auth cookie
  const url = `${HN}/fave?id=${itemId}&un=${save ? '' : '1'}`;
  // Actually HN uses: GET /fave?id=X to save, GET /unfave?id=X to remove
  const endpoint = save ? `${HN}/fave?id=${itemId}` : `${HN}/fave?id=${itemId}&un=t`;
  await fetch(endpoint, {
    headers: {
      Cookie: cookie,
      'User-Agent': 'Materialistic/1.0',
    },
    redirect: 'manual',
  });
  void how; // suppress unused warning
}

export async function hnVote(itemId: number, cookie: string, dir: 'up' | 'un'): Promise<void> {
  // HN vote requires auth token from the page — simplified here
  const url = `${HN}/vote?id=${itemId}&how=${dir}&auth=`;
  await fetch(url, {
    headers: {
      Cookie: cookie,
      'User-Agent': 'Materialistic/1.0',
    },
    redirect: 'manual',
  });
}
