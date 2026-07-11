/**
 * Juice system — particles, screen shake, hitstop, and a WebAudio synth.
 *
 * Replaces the Phase 0 no-op stubs. Every scene/mechanic calls the same hooks
 * (burst / shake / hitstop / tone / flash); this system makes them real and is
 * driven by the App each frame (update + render). Honours
 * prefers-reduced-motion (disables motion, keeps audio) and a persisted mute.
 */

export interface BurstOptions {
  count?: number;
  color?: string;
  speed?: number;
  spread?: number; // radians; full circle by default
  angle?: number; // base direction
  gravity?: number;
  life?: number; // seconds
  size?: number;
}

export interface ToneOptions {
  durationMs?: number;
  type?: OscillatorType;
  volume?: number;
}

export interface Juice {
  burst(x: number, y: number, opts?: BurstOptions): void;
  shake(magnitude: number, durationMs?: number): void;
  hitstop(durationMs: number): void;
  tone(freq: number, opts?: ToneOptions): void;
  flash(color: string, strength?: number): void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

const MUTE_KEY = 'comet:muted';

export class JuiceSystem implements Juice {
  readonly reducedMotion: boolean;
  private particles: Particle[] = [];
  private trauma = 0; // 0..1, decays; shake = trauma^2
  private shakeMax = 22;
  private hitstopMs = 0;
  private flashColor = '#000';
  private flashAlpha = 0;

  private audio: AudioContext | null = null;
  private muted = false;

  constructor() {
    this.reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  // ---- lifecycle (called by App) -----------------------------------------

  get frozen(): boolean {
    return this.hitstopMs > 0;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  update(dtSec: number): void {
    if (this.hitstopMs > 0) this.hitstopMs = Math.max(0, this.hitstopMs - dtSec * 1000);

    this.trauma = Math.max(0, this.trauma - dtSec * 1.6);
    this.flashAlpha = Math.max(0, this.flashAlpha - dtSec * 3.2);

    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i] as Particle;
      p.life -= dtSec;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1] as Particle;
        ps.pop();
        continue;
      }
      p.vy += p.gravity * dtSec;
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
    }
  }

  /** Screen-space shake offset for this frame (already gated by reduced-motion). */
  shakeOffset(): { x: number; y: number } {
    if (this.reducedMotion || this.trauma <= 0) return ZERO;
    const s = this.trauma * this.trauma * this.shakeMax;
    return { x: (Math.random() * 2 - 1) * s, y: (Math.random() * 2 - 1) * s };
  }

  renderParticles(ctx: CanvasRenderingContext2D): void {
    if (this.particles.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const a = Math.min(1, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Full-screen flash overlay (drawn un-shaken, above particles). */
  renderOverlays(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.flashAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.flashAlpha);
    ctx.fillStyle = this.flashColor;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // ---- Juice interface ----------------------------------------------------

  burst(x: number, y: number, opts: BurstOptions = {}): void {
    if (this.reducedMotion) return;
    const count = opts.count ?? 12;
    const color = opts.color ?? '#4de1c1';
    const speed = opts.speed ?? 180;
    const spread = opts.spread ?? Math.PI * 2;
    const base = opts.angle ?? 0;
    const gravity = opts.gravity ?? 260;
    const life = opts.life ?? 0.55;
    const size = opts.size ?? 3;
    for (let i = 0; i < count; i++) {
      const ang = base + (Math.random() - 0.5) * spread;
      const spd = speed * (0.4 + Math.random() * 0.8);
      const l = life * (0.6 + Math.random() * 0.6);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: l,
        maxLife: l,
        size: size * (0.6 + Math.random() * 0.9),
        color,
        gravity,
      });
    }
    // hard cap to protect the frame budget
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  shake(magnitude: number, _durationMs = 220): void {
    if (this.reducedMotion) return;
    this.trauma = Math.min(1, this.trauma + magnitude);
  }

  hitstop(durationMs: number): void {
    if (this.reducedMotion) return;
    this.hitstopMs = Math.max(this.hitstopMs, durationMs);
  }

  flash(color: string, strength = 0.5): void {
    if (this.reducedMotion) return;
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, strength);
  }

  tone(freq: number, opts: ToneOptions = {}): void {
    if (this.muted) return;
    const ctx = this.ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = (opts.durationMs ?? 110) / 1000;
    const vol = opts.volume ?? 0.14;
    // slight random detune keeps repeated hits from feeling robotic
    const f = freq * (1 + (Math.random() - 0.5) * 0.03);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(f, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(vol, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private ensureAudio(): AudioContext | null {
    if (this.audio) {
      if (this.audio.state === 'suspended') void this.audio.resume();
      return this.audio;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.audio = new Ctor();
      return this.audio;
    } catch {
      return null;
    }
  }
}

const ZERO = { x: 0, y: 0 };

/** Factory kept for call sites that only need the Juice interface. */
export function createJuice(): JuiceSystem {
  return new JuiceSystem();
}
