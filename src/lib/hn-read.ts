// HN Firebase API — read-only story and comment fetching
const BASE = 'https://hacker-news.firebaseio.com/v0';

export interface HNItem {
  id: number;
  type: 'story' | 'comment' | 'job' | 'ask' | 'show' | 'poll';
  title?: string;
  url?: string;
  text?: string;
  by?: string;
  score?: number;
  time: number;
  descendants?: number;
  kids?: number[];
  parent?: number;
  dead?: boolean;
  deleted?: boolean;
}

export type Section = 'top' | 'new' | 'best' | 'ask' | 'show' | 'jobs';

const sectionEndpoint: Record<Section, string> = {
  top: 'topstories',
  new: 'newstories',
  best: 'beststories',
  ask: 'askstories',
  show: 'showstories',
  jobs: 'jobstories',
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 60 } } as RequestInit);
  if (!res.ok) throw new Error(`HN API ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export async function getStoryIds(section: Section, limit = 30): Promise<number[]> {
  const ids = await fetchJson<number[]>(`${BASE}/${sectionEndpoint[section]}.json`);
  return ids.slice(0, limit);
}

export async function getItem(id: number): Promise<HNItem | null> {
  try {
    return await fetchJson<HNItem>(`${BASE}/item/${id}.json`);
  } catch {
    return null;
  }
}

export async function getItems(ids: number[]): Promise<HNItem[]> {
  const results = await Promise.allSettled(ids.map(getItem));
  return results
    .filter((r): r is PromiseFulfilledResult<HNItem> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

export async function getStories(section: Section, page = 1, perPage = 30): Promise<HNItem[]> {
  const allIds = await fetchJson<number[]>(`${BASE}/${sectionEndpoint[section]}.json`);
  const start = (page - 1) * perPage;
  const ids = allIds.slice(start, start + perPage);
  return getItems(ids);
}

export function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

export function getDomain(url?: string): string {
  if (!url) return 'news.ycombinator.com';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isHot(score?: number): boolean {
  return (score ?? 0) >= 200;
}
