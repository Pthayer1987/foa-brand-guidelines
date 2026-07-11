/** Per-run telemetry, logged to console and persisted to localStorage. */
export interface RunRecord {
  proto: string;
  seed: number;
  runMs: number;
  score: number;
  distance: number;
  nearMisses: number;
  deathsPerMin: number;
  ts: number;
}

const key = (proto: string): string => `comet:telemetry:${proto}`;
const MAX_RECORDS = 200;

export function recordRun(rec: RunRecord): void {
  console.log(
    `[${rec.proto}] run ${rec.runMs.toFixed(0)}ms score=${rec.score} ` +
      `near=${rec.nearMisses} dpm=${rec.deathsPerMin.toFixed(1)}`,
    rec,
  );
  try {
    const raw = localStorage.getItem(key(rec.proto));
    const arr: RunRecord[] = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(key(rec.proto), JSON.stringify(arr.slice(-MAX_RECORDS)));
  } catch {
    /* localStorage unavailable — telemetry is best-effort */
  }
}

export function loadRuns(proto: string): RunRecord[] {
  try {
    const raw = localStorage.getItem(key(proto));
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

/** Median of a numeric array (0 for empty). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}
