import { toast } from './ui/dom';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const CACHE = 'comet-v1';

/** Registers the offline service worker and warms the cache with the app shell. */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* SW unsupported / blocked — game still works online */
    });
    // The first load's asset fetches happen before the SW takes control, so
    // seed the cache from the page with the actual (hashed) URLs it loaded.
    setTimeout(() => void warmCache(), 800);
  });
}

async function warmCache(): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE);
    const urls = new Set<string>(['/', location.pathname, '/manifest.webmanifest']);
    for (const e of performance.getEntriesByType('resource')) {
      const u = new URL((e as PerformanceResourceTiming).name);
      if (u.origin === location.origin) urls.add(u.pathname + u.search);
    }
    await Promise.all([...urls].map((u) => cache.add(u).catch(() => undefined)));
  } catch {
    /* best effort */
  }
}

/** Offers an install prompt after the player's 3rd session (per spec). */
export function initInstallPrompt(): void {
  let deferred: InstallPromptEvent | null = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    if (sessionCount() < 3) return;
    toast('Tap anywhere to add COMET to your home screen', 3000);
    const onTap = async (): Promise<void> => {
      window.removeEventListener('pointerdown', onTap);
      if (!deferred) return;
      const d = deferred;
      deferred = null;
      await d.prompt();
    };
    // one-shot, after a short delay so it doesn't eat the current gesture
    setTimeout(() => window.addEventListener('pointerdown', onTap, { once: true }), 400);
  });
}

function sessionCount(): number {
  try {
    const raw = localStorage.getItem('comet:profile');
    return raw ? (JSON.parse(raw).sessions ?? 0) : 0;
  } catch {
    return 0;
  }
}
