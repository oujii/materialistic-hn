// Scrapes HN favorites page and article content using readability
import { load } from 'cheerio';

const HN = 'https://news.ycombinator.com';

export interface SavedStory {
  id: number;
  title: string;
  url: string;
  domain: string;
  score?: number;
  by?: string;
  time?: number;
  comments?: number;
}

// Lightweight: just fetch the first page of the user's favorites and return the set of IDs.
// Used by listing views to show the bookmark indicator without fetching all pages.
export async function fetchFavoriteIds(username: string, cookie: string): Promise<Set<number>> {
  const ids = new Set<number>();
  try {
    const res = await fetch(`${HN}/favorites?id=${username}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return ids;
    const html = await res.text();
    const matches = html.matchAll(/class="athing[^"]*" id="(\d+)"/g);
    for (const m of matches) ids.add(parseInt(m[1]));
  } catch {
    // best-effort; just return what we have
  }
  return ids;
}

export async function fetchFavorites(username: string, cookie: string): Promise<SavedStory[]> {
  const stories: SavedStory[] = [];
  let p = 1;

  while (p <= 5) { // cap at 5 pages = 150 stories
    const res = await fetch(`${HN}/favorites?id=${username}&p=${p}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Materialistic/1.0',
      },
    });
    const html = await res.text();
    const $ = load(html);

    const rows = $('tr.athing');
    if (rows.length === 0) break;

    rows.each((_, row) => {
      const id = parseInt($(row).attr('id') ?? '0');
      const titleEl = $(row).find('span.titleline > a').first();
      const title = titleEl.text().trim();
      const url = titleEl.attr('href') ?? `${HN}/item?id=${id}`;
      const domain = $(row).find('span.sitestr').text().trim();

      const subRow = $(row).next('tr');
      const score = parseInt(subRow.find('span.score').text()) || undefined;
      const by = subRow.find('a.hnuser').first().text().trim() || undefined;
      const commentsLink = subRow.find('a').last();
      const comments = parseInt(commentsLink.text()) || 0;

      if (id && title) {
        stories.push({ id, title, url, domain, score, by, comments });
      }
    });

    const moreLink = $('a.morelink');
    if (!moreLink.length) break;
    p++;
  }

  return stories;
}

export async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Materialistic/1.0)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) return null;
    const html = await res.text();
    return html;
  } catch {
    return null;
  }
}
