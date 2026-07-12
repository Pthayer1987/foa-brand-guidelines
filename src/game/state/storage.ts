/** Thin localStorage helpers with a best-effort obfuscation for anti-tamper. */

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — best effort */
  }
}

// Lightweight obfuscation for daily attempts (honour-system only, per spec).
const OBF_KEY = 'c0met';

function xorString(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    out += String.fromCharCode(s.charCodeAt(i) ^ OBF_KEY.charCodeAt(i % OBF_KEY.length));
  }
  return out;
}

export function readObfuscated<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(xorString(atob(raw))) as T;
  } catch {
    return fallback;
  }
}

export function writeObfuscated(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, btoa(xorString(JSON.stringify(value))));
  } catch {
    /* best effort */
  }
}
