// Server-side session helpers — read/write HttpOnly session cookie
import { encrypt, decrypt } from './crypto';

const COOKIE_NAME = 'hn_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface Session {
  username: string;
  cookie: string;
}

export async function getSession(request: Request): Promise<Session | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const raw = await decrypt(match[1]);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function createSessionCookie(session: Session): Promise<string> {
  const encrypted = await encrypt(JSON.stringify(session));
  return `${COOKIE_NAME}=${encrypted}; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`;
}
