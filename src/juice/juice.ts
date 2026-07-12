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
  private noiseBuffer: AudioBuffer | null = null;
  private bus: GainNode | null = null;
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
    // slight random detune keeps repeated hits from feeling robotic
    const f = freq * (1 + (Math.random() - 0.5) * 0.03);
    this.voice(f, f, opts.type ?? 'triangle', (opts.durationMs ?? 110) / 1000, opts.volume ?? 0.14);
  }

  // ---- richer named SFX ---------------------------------------------------

  /** A single voice: oscillator with optional pitch glide, ADSR-ish env,
   *  stereo pan, routed through the reverb/compressor bus. */
  private voice(
    f0: number,
    f1: number,
    type: OscillatorType,
    dur: number,
    vol: number,
    when = 0,
    pan = 0,
  ): void {
    const ctx = this.ensureAudio();
    const bus = this.bus;
    if (!ctx || !bus) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.send(osc, gain, pan);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Filtered white-noise burst — impacts and whooshes. */
  private noise(
    dur: number,
    vol: number,
    f0: number,
    f1: number,
    type: BiquadFilterType,
    pan = 0,
  ): void {
    const ctx = this.ensureAudio();
    const bus = this.bus;
    if (!ctx || !bus) return;
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f0, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    this.send(filt, gain, pan);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Wire source → gain → (optional pan) → bus. */
  private send(source: AudioNode, gain: GainNode, pan: number): void {
    const ctx = this.audio;
    const bus = this.bus;
    if (!ctx || !bus) return;
    source.connect(gain);
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(p).connect(bus);
    } else {
      gain.connect(bus);
    }
  }

  /** Run start — layered rising sweep with a soft air swell. */
  sfxStart(): void {
    if (this.muted) return;
    this.voice(160, 480, 'sine', 0.24, 0.08);
    this.voice(240, 720, 'triangle', 0.22, 0.05, 0.02);
    this.noise(0.24, 0.03, 300, 3000, 'bandpass');
  }

  /** Gravity flip — a snappy "fwip": detuned blip + airy noise tick. */
  sfxFlip(up = true): void {
    if (this.muted) return;
    const a = up ? 250 : 470;
    const b = up ? 540 : 230;
    const pan = up ? -0.15 : 0.15;
    this.voice(a, b, 'triangle', 0.09, 0.08, 0, pan);
    this.voice(a * 1.5, b * 1.5, 'sine', 0.07, 0.03, 0, pan);
    this.noise(0.05, 0.04, 3000, 600, 'bandpass', pan);
  }

  /** Near miss — climbs a pentatonic scale by combo, bell-like with a fifth. */
  sfxNear(combo: number): void {
    if (this.muted) return;
    const scale = [0, 3, 5, 7, 10];
    const idx = Math.max(0, combo - 1);
    const semi = (scale[idx % scale.length] as number) + 12 * Math.floor(idx / scale.length);
    const f = 523 * Math.pow(2, semi / 12);
    const pan = (Math.random() - 0.5) * 0.5;
    this.voice(f, f, 'sine', 0.18, 0.12, 0, pan);
    this.voice(f * 1.5, f * 1.5, 'sine', 0.14, 0.05, 0.01, pan); // a fifth above
    this.voice(f * 2.01, f * 2.01, 'triangle', 0.1, 0.04, 0.005, pan); // shimmer octave
  }

  /** Pickup — bright three-note sparkle arpeggio + a tiny sparkle hiss. */
  sfxPickup(): void {
    if (this.muted) return;
    this.voice(720, 720, 'triangle', 0.07, 0.1, 0);
    this.voice(1080, 1080, 'triangle', 0.08, 0.08, 0.045);
    this.voice(1440, 1440, 'sine', 0.1, 0.06, 0.09);
    this.noise(0.08, 0.02, 5000, 8000, 'highpass');
  }

  /** Crash — layered saw drop + sub boom + filtered noise thud. */
  sfxDeath(): void {
    if (this.muted) return;
    this.voice(320, 55, 'sawtooth', 0.4, 0.16, 0, -0.1);
    this.voice(190, 42, 'sine', 0.5, 0.14, 0, 0.1); // sub boom
    this.voice(130, 30, 'triangle', 0.45, 0.08, 0.02);
    this.noise(0.38, 0.16, 1600, 90, 'lowpass');
  }

  /** New best — a two-layer rising major arpeggio fanfare. */
  sfxBest(): void {
    if (this.muted) return;
    const base = 523;
    [0, 4, 7, 12].forEach((s, i) => {
      const f = base * Math.pow(2, s / 12);
      const pan = (i - 1.5) * 0.25;
      this.voice(f, f, 'triangle', 0.22, 0.11, i * 0.11, pan);
      this.voice(f * 2, f * 2, 'sine', 0.18, 0.045, i * 0.11 + 0.01, pan);
    });
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
      const ctx = new Ctor();
      this.buildChain(ctx);
      this.audio = ctx;
      return ctx;
    } catch {
      return null;
    }
  }

  /** Master chain: bus → (dry + convolver reverb) → soft compressor → out. */
  private buildChain(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);

    const bus = ctx.createGain();
    bus.connect(master); // dry path

    // convolver reverb for space/depth
    try {
      const convolver = ctx.createConvolver();
      convolver.buffer = this.makeImpulse(ctx, 1.8, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      bus.connect(convolver).connect(wet).connect(master);
    } catch {
      /* reverb optional */
    }

    this.bus = bus;
  }

  /** Procedural impulse response: exponentially-decaying stereo noise. */
  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }
}

const ZERO = { x: 0, y: 0 };

/** Factory kept for call sites that only need the Juice interface. */
export function createJuice(): JuiceSystem {
  return new JuiceSystem();
}
