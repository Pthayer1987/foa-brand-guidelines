import { medalFor } from './core/config';
import { utcDateString } from './dailySeed';

const EPOCH = '2026-01-01';
const SHARE_URL = 'https://comet.game'; // updated at deploy; only used in share text

export function dayNumber(date = utcDateString()): number {
  const a = Date.parse(EPOCH + 'T00:00:00Z');
  const b = Date.parse(date + 'T00:00:00Z');
  return Math.floor((b - a) / 86400000) + 1;
}

export interface ShareData {
  score: number;
  nearMisses: number;
  streak: number;
  date?: string;
}

/** Wordle-style emoji result text — intriguing in a group chat without explanation. */
export function shareText(d: ShareData): string {
  const day = dayNumber(d.date);
  const medal = medalFor(d.score);
  const ratio = Math.max(0, Math.min(1, d.score / 6000));
  const filled = Math.round(ratio * 10);
  const bar = '🟩'.repeat(filled) + '⬛'.repeat(10 - filled);
  const streak = d.streak > 0 ? ` · 🔥${d.streak}` : '';
  return (
    `COMET #${day}  ${medal.emoji} ${d.score}\n` +
    `${bar}\n` +
    `✨×${d.nearMisses}${streak}\n` +
    SHARE_URL
  );
}

/** Renders a 1200×630 share card to a Blob (OG image size). */
export function shareImage(d: ShareData): Promise<Blob | null> {
  const W = 1200;
  const H = 630;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d');
  if (!c) return Promise.resolve(null);

  // background
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0d1c');
  g.addColorStop(1, '#070912');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // nebula
  const neb = c.createRadialGradient(W * 0.75, H * 0.3, 0, W * 0.75, H * 0.3, 700);
  neb.addColorStop(0, 'rgba(77,225,193,0.16)');
  neb.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = neb;
  c.fillRect(0, 0, W, H);
  // stars (deterministic-ish scatter)
  c.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 80; i++) {
    const x = (i * 9301 + 49297) % W;
    const y = (i * 233280 + 12345) % H;
    c.globalAlpha = 0.2 + ((i * 7) % 10) / 20;
    c.beginPath();
    c.arc(x, y, ((i * 3) % 3) + 1, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;

  const day = dayNumber(d.date);
  const medal = medalFor(d.score);

  c.textAlign = 'left';
  c.fillStyle = '#7b83a6';
  c.font = '600 34px system-ui, sans-serif';
  c.fillText(`COMET · Daily #${day}`, 80, 110);

  c.save();
  c.shadowColor = '#4de1c1';
  c.shadowBlur = 40;
  c.fillStyle = '#f2f5ff';
  c.font = '800 150px system-ui, sans-serif';
  c.fillText(String(d.score), 76, 300);
  c.restore();

  c.font = '700 60px system-ui, sans-serif';
  c.fillText(`${medal.emoji} ${medal.label}`, 80, 400);

  c.fillStyle = '#4de1c1';
  c.font = '600 42px system-ui, sans-serif';
  c.fillText(`✨ ${d.nearMisses} near misses`, 80, 480);
  if (d.streak > 0) c.fillText(`🔥 ${d.streak} day streak`, 80, 545);

  // progress bar
  const ratio = Math.max(0, Math.min(1, d.score / 6000));
  c.fillStyle = 'rgba(123,131,166,0.3)';
  c.fillRect(720, 470, 400, 20);
  c.fillStyle = '#4de1c1';
  c.fillRect(720, 470, 400 * ratio, 20);

  return new Promise((resolve) => cv.toBlob((b) => resolve(b), 'image/png'));
}

export interface ShareResult {
  method: 'shared' | 'clipboard' | 'download' | 'none';
}

/** One-tap share: native sheet with image where supported, else clipboard + toast. */
export async function shareResult(d: ShareData): Promise<ShareResult> {
  const text = shareText(d);
  const blob = await shareImage(d);
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData & { files?: File[] }) => boolean;
    share?: (data: unknown) => Promise<void>;
  };

  // Try native share with the image file
  if (blob && nav.share) {
    const file = new File([blob], `comet-${dayNumber(d.date)}.png`, { type: 'image/png' });
    const payload: { text: string; files?: File[] } = { text };
    if (nav.canShare?.({ files: [file] })) payload.files = [file];
    try {
      await nav.share(payload);
      return { method: 'shared' };
    } catch {
      /* user cancelled or share failed — fall through to clipboard */
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
    return { method: 'clipboard' };
  } catch {
    /* clipboard blocked — offer download */
  }

  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comet-${dayNumber(d.date)}.png`;
    a.click();
    URL.revokeObjectURL(url);
    return { method: 'download' };
  }
  return { method: 'none' };
}
