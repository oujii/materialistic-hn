// AES-GCM encryption for HN session cookies stored server-side
const secret = process.env.COOKIE_SECRET ?? 'dev-secret-change-in-production!!';

async function getKey(): Promise<CryptoKey> {
  const raw = Buffer.from(secret.slice(0, 32).padEnd(32, '0'));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return Buffer.from(combined).toString('base64url');
}

export async function decrypt(token: string): Promise<string | null> {
  try {
    const key = await getKey();
    const combined = Buffer.from(token, 'base64url');
    const iv = combined.subarray(0, 12);
    const ciphertext = combined.subarray(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
