import { Jamo, decompose } from './hangul';
import { WORDS, isWord } from './words';

/**
 * 꼬들 채점 규칙.
 * 두 글자 낱말을 [초성, 중성, 종성] × 2 = 여섯 칸으로 펼쳐 자모 단위로 맞춘다.
 * 받침이 없는 글자의 종성 칸은 "없음"으로 두고 채점에서 빼둔다.
 * 겹받침(ㄳ)과 복모음(ㅘ)은 하나의 자모로 본다.
 */

export const WORD_LENGTH = 2;
export const SLOTS = 6;
export const MAX_TRIES = 8;

export type SlotState = 'hit' | 'present' | 'miss' | 'empty';

export interface SlotResult {
  /** 자모 (받침이 없으면 빈 문자열) */
  jamo: string;
  state: SlotState;
}

/** 낱말 → 자모 여섯 칸 */
export function toSlots(word: string): string[] {
  const jamos = [...word].map(decompose).filter((j): j is Jamo => j !== null);
  const out: string[] = [];
  for (const j of jamos) out.push(j.cho, j.jung, j.jong);
  return out;
}

/** 추측을 정답과 견줘 칸마다 상태를 매긴다 */
export function scoreGuess(guess: string, answer: string): SlotResult[] {
  const g = toSlots(guess);
  const a = toSlots(answer);
  const result: SlotResult[] = g.map((jamo) => ({ jamo, state: jamo === '' ? 'empty' : 'miss' }));

  /* 남은 자모 개수를 세어 두고 자리부터 맞춘다 */
  const remaining = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '') continue;
    if (g[i] === a[i]) {
      result[i].state = 'hit';
      continue;
    }
    remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
  }

  for (let i = 0; i < g.length; i++) {
    if (result[i].state !== 'miss') continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      result[i].state = 'present';
      remaining.set(g[i], left - 1);
    }
  }

  return result;
}

/** 자판 색칠에 쓰는 자모별 최고 상태 */
export function mergeKeyStates(
  prev: Record<string, SlotState>,
  results: SlotResult[]
): Record<string, SlotState> {
  const rank: Record<SlotState, number> = { empty: 0, miss: 1, present: 2, hit: 3 };
  const next = { ...prev };
  for (const r of results) {
    if (!r.jamo) continue;
    const cur = next[r.jamo];
    if (!cur || rank[r.state] > rank[cur]) next[r.jamo] = r.state;
  }
  return next;
}

export type GuessError = 'length' | 'unknown' | null;

/** 입력이 제출 가능한지 검사 */
export function validateGuess(guess: string): GuessError {
  if ([...guess].length !== WORD_LENGTH) return 'length';
  if (!isWord(guess)) return 'unknown';
  return null;
}

export const wordCount = () => WORDS.length;
export const wordAt = (index: number) => WORDS[index % WORDS.length];

/** 결과를 공유용 이모지 격자로 */
export function shareGrid(rows: SlotResult[][]): string {
  const mark: Record<SlotState, string> = { hit: '🟩', present: '🟨', miss: '⬛', empty: '⬜' };
  return rows.map((r) => r.map((s) => mark[s.state]).join('')).join('\n');
}
