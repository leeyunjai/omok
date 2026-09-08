import { create } from 'zustand';
import { HangulComposer } from './hangul';
import {
  MAX_TRIES, SlotResult, SlotState, WORD_LENGTH,
  mergeKeyStates, scoreGuess, shareGrid, validateGuess, wordAt, wordCount,
} from './engine';
import { createStore } from '../../shared/storage';
import { dailyIndex, getDaily, recordDaily, todayKey, todayResult, activeStreak } from '../../shared/daily';
import { setProgress, clearProgress } from '../../shared/progress';
import { submitBest } from '../../shared/records';
import { sfx } from '../../shared/sound';

const store = createStore('kkodle');
const PROGRESS_KEY = 'progress';

export type Mode = 'daily' | 'free';
export type Status = 'playing' | 'won' | 'lost';

export interface Row {
  word: string;
  result: SlotResult[];
}

interface SavedProgress {
  date: string;
  guesses: string[];
}

/* 입력 조합기는 상태가 아니라 도구라서 스토어 밖에 둔다 */
const composer = new HangulComposer(WORD_LENGTH);

interface State {
  mode: Mode;
  answer: string;
  rows: Row[];
  input: string;
  status: Status;
  keyStates: Record<string, SlotState>;
  message: string | null;
  /* 흔들림 애니메이션 트리거 */
  shake: number;
  streak: number;
  bestStreak: number;
  playedToday: boolean;

  setMode: (mode: Mode) => void;
  pushJamo: (jamo: string) => void;
  backspace: () => void;
  submit: () => void;
  newFreeGame: () => void;
  shareResult: () => Promise<boolean>;
  dismissMessage: () => void;
}

function pickDailyWord(): string {
  return wordAt(dailyIndex('kkodle', wordCount()));
}

function pickRandomWord(): string {
  return wordAt(Math.floor(Math.random() * wordCount()));
}

function loadDailyProgress(): string[] {
  const saved = store.get<SavedProgress | null>(PROGRESS_KEY, null);
  if (!saved || saved.date !== todayKey()) return [];
  return Array.isArray(saved.guesses) ? saved.guesses : [];
}

function saveDailyProgress(guesses: string[]) {
  if (guesses.length === 0) {
    store.remove(PROGRESS_KEY);
    clearProgress('kkodle');
    return;
  }
  store.set(PROGRESS_KEY, { date: todayKey(), guesses } satisfies SavedProgress);
}

function rebuild(answer: string, guesses: string[]) {
  const rows: Row[] = guesses.map((word) => ({ word, result: scoreGuess(word, answer) }));
  let keyStates: Record<string, SlotState> = {};
  for (const r of rows) keyStates = mergeKeyStates(keyStates, r.result);
  const won = rows.some((r) => r.word === answer);
  const status: Status = won ? 'won' : rows.length >= MAX_TRIES ? 'lost' : 'playing';
  return { rows, keyStates, status };
}

export const useKkodle = create<State>()((set, get) => {
  const answer = pickDailyWord();
  const saved = loadDailyProgress();
  const initial = rebuild(answer, saved);
  const rec = getDaily('kkodle');

  return {
    mode: 'daily',
    answer,
    input: '',
    message: null,
    shake: 0,
    streak: activeStreak(rec),
    bestStreak: rec.bestStreak,
    playedToday: todayResult('kkodle') !== null,
    ...initial,

    setMode: (mode) => {
      composer.clear();
      if (mode === 'daily') {
        const a = pickDailyWord();
        set({ mode, answer: a, input: '', message: null, ...rebuild(a, loadDailyProgress()) });
      } else {
        const a = pickRandomWord();
        set({ mode, answer: a, input: '', message: null, rows: [], keyStates: {}, status: 'playing' });
      }
    },

    pushJamo: (jamo) => {
      if (get().status !== 'playing') return;
      composer.push(jamo);
      set({ input: composer.text(), message: null });
    },

    backspace: () => {
      if (get().status !== 'playing') return;
      composer.backspace();
      set({ input: composer.text(), message: null });
    },

    submit: () => {
      const s = get();
      if (s.status !== 'playing') return;
      const guess = composer.text();

      const err = validateGuess(guess);
      if (err) {
        sfx.alert();
        set({
          message: err === 'length' ? '두 글자를 채워 주세요' : `사전에 없는 낱말이에요 · ${guess}`,
          shake: s.shake + 1,
        });
        return;
      }
      if (s.rows.some((r) => r.word === guess)) {
        set({ message: '이미 써 본 낱말이에요', shake: s.shake + 1 });
        return;
      }

      const result = scoreGuess(guess, s.answer);
      const rows = [...s.rows, { word: guess, result }];
      const keyStates = mergeKeyStates(s.keyStates, result);
      const won = guess === s.answer;
      const status: Status = won ? 'won' : rows.length >= MAX_TRIES ? 'lost' : 'playing';

      composer.clear();
      set({ rows, keyStates, status, input: '', message: null });

      if (won) sfx.win();
      else if (status === 'lost') sfx.lose();
      else sfx.tap();

      if (s.mode !== 'daily') return;

      saveDailyProgress(rows.map((r) => r.word));
      if (status === 'playing') {
        setProgress('kkodle', `오늘의 문제 ${rows.length}/${MAX_TRIES}`);
        return;
      }

      /* 오늘 문제가 끝났다 — 연속 일수를 갱신한다 */
      const rec = recordDaily('kkodle', { solved: won, tries: rows.length });
      clearProgress('kkodle');
      submitBest('kkodle', 'streak', rec.bestStreak, `최고 ${rec.bestStreak}일 연속`, true);
      set({ streak: activeStreak(rec), bestStreak: rec.bestStreak, playedToday: true });
    },

    newFreeGame: () => {
      composer.clear();
      set({ mode: 'free', answer: pickRandomWord(), rows: [], keyStates: {}, status: 'playing', input: '', message: null });
    },

    shareResult: async () => {
      const s = get();
      const head = s.mode === 'daily' ? `꼬들 ${todayKey()}` : '꼬들';
      const score = s.status === 'won' ? `${s.rows.length}/${MAX_TRIES}` : `X/${MAX_TRIES}`;
      const text = `${head} ${score}\n\n${shareGrid(s.rows.map((r) => r.result))}`;
      try {
        await navigator.clipboard.writeText(text);
        set({ message: '결과를 복사했어요' });
        return true;
      } catch {
        set({ message: '복사할 수 없어요' });
        return false;
      }
    },

    dismissMessage: () => set({ message: null }),
  };
});

export { MAX_TRIES, WORD_LENGTH };
