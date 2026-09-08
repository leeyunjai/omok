import { createStore } from './storage';

/**
 * 날짜 기반 데일리 게임 공통 로직.
 * 서버가 없으므로 "오늘의 문제"는 기기 로컬 날짜 + 고정 시드로 결정론적으로 뽑는다.
 * 같은 날 같은 기기에서는 항상 같은 문제가 나온다.
 */

/** 로컬 기준 YYYY-MM-DD */
export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 시드 난수 (mulberry32).
 * 같은 시드면 언제 어디서 돌려도 같은 수열이 나오므로,
 * 서버 없이 "모두에게 같은 오늘의 문제"를 만들 수 있다.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 날짜 키를 32비트 정수 해시로 (FNV-1a) */
export function hashDate(key: string, salt = ''): number {
  let h = 0x811c9dc5;
  for (const ch of `${salt}:${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 오늘의 문제를 만들 때 쓸 난수 — 날짜와 게임 이름으로 시드를 만든다 */
export function dailyRandom(gameId: string, dateKey = todayKey()): () => number {
  return seededRandom(hashDate(dateKey, gameId));
}

/** 오늘의 문제 번호 — 같은 날이면 항상 같은 값 */
export function dailyIndex(gameId: string, poolSize: number, dateKey = todayKey()): number {
  if (poolSize <= 0) return 0;
  return hashDate(dateKey, gameId) % poolSize;
}

/** 날짜 키 사이의 일수 차이 */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86400000);
}

export interface DailyResult {
  /** 맞혔는지 */
  solved: boolean;
  /** 몇 번 만에 (실패면 시도 횟수) */
  tries: number;
}

export interface DailyRecord {
  /** 날짜별 결과 (최근 60일만 보관) */
  days: Record<string, DailyResult>;
  streak: number;
  bestStreak: number;
  played: number;
  solvedCount: number;
  lastPlayed: string | null;
}

const EMPTY: DailyRecord = { days: {}, streak: 0, bestStreak: 0, played: 0, solvedCount: 0, lastPlayed: null };
const KEY = 'daily';

export function getDaily(gameId: string): DailyRecord {
  return { ...EMPTY, ...createStore(gameId).get<Partial<DailyRecord>>(KEY, {}) };
}

/** 오늘 문제를 이미 끝냈는지 */
export function todayResult(gameId: string, dateKey = todayKey()): DailyResult | null {
  return getDaily(gameId).days[dateKey] ?? null;
}

/** 오늘 결과를 기록하고 연속 일수를 갱신한다. 같은 날 두 번 기록해도 처음 것만 남는다. */
export function recordDaily(gameId: string, result: DailyResult, dateKey = todayKey()): DailyRecord {
  const store = createStore(gameId);
  const rec = getDaily(gameId);
  if (rec.days[dateKey]) return rec;

  const days = { ...rec.days, [dateKey]: result };
  /* 오래된 기록은 버린다 */
  for (const k of Object.keys(days)) {
    if (daysBetween(k, dateKey) > 60) delete days[k];
  }

  let streak = rec.streak;
  if (!result.solved) {
    streak = 0;
  } else if (rec.lastPlayed && daysBetween(rec.lastPlayed, dateKey) === 1 && rec.days[rec.lastPlayed]?.solved) {
    streak = rec.streak + 1;
  } else {
    streak = 1;
  }

  const next: DailyRecord = {
    days,
    streak,
    bestStreak: Math.max(rec.bestStreak, streak),
    played: rec.played + 1,
    solvedCount: rec.solvedCount + (result.solved ? 1 : 0),
    lastPlayed: dateKey,
  };
  store.set(KEY, next);
  return next;
}

/** 연속 일수가 오늘/어제 기준으로 아직 살아 있는지 */
export function activeStreak(rec: DailyRecord, dateKey = todayKey()): number {
  if (!rec.lastPlayed) return 0;
  const gap = daysBetween(rec.lastPlayed, dateKey);
  return gap <= 1 ? rec.streak : 0;
}
