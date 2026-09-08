import { create } from 'zustand';
import {
  LEVELS, Layout, Level, chordTargets, floodReveal, generate, isCleared, neighbors,
} from './engine';
import { createStore } from '../../shared/storage';
import { setProgress, clearProgress } from '../../shared/progress';
import { submitBest, getBest } from '../../shared/records';
import { sfx } from '../../shared/sound';

const store = createStore('minesweeper');
const SAVE_KEY = 'game';
const PREF_KEY = 'pref';

export type Status = 'ready' | 'playing' | 'won' | 'lost';

interface Saved {
  level: Level;
  mines: number[];
  revealed: number[];
  flagged: number[];
  elapsedMs: number;
}

interface State {
  level: Level;
  layout: Layout | null;
  revealed: Uint8Array;
  flagged: Uint8Array;
  status: Status;
  flagMode: boolean;
  exploded: number;
  elapsedMs: number;
  /* 배열을 직접 고치므로 이 값이 바뀔 때 다시 그린다 */
  version: number;
  hasSave: boolean;

  setLevel: (level: Level) => void;
  setFlagMode: (on: boolean) => void;
  reveal: (i: number) => void;
  toggleFlag: (i: number) => void;
  chord: (i: number) => void;
  restart: () => void;
  resumeSaved: () => void;
  tick: (ms: number) => void;
  minesLeft: () => number;
}

function emptyArrays(level: Level) {
  const spec = LEVELS[level];
  const size = spec.cols * spec.rows;
  return { revealed: new Uint8Array(size), flagged: new Uint8Array(size) };
}

function loadSaved(): Saved | null {
  const s = store.get<Saved | null>(SAVE_KEY, null);
  if (!s || !LEVELS[s.level] || !Array.isArray(s.mines)) return null;
  const size = LEVELS[s.level].cols * LEVELS[s.level].rows;
  if (s.mines.length !== size) return null;
  return s;
}

function rebuildLayout(level: Level, mines: number[]): Layout {
  const spec = LEVELS[level];
  const arr = Uint8Array.from(mines);
  const counts = new Uint8Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) continue;
    counts[i] = neighbors(i, spec.cols, spec.rows).filter((j) => arr[j]).length;
  }
  return { cols: spec.cols, rows: spec.rows, mines: arr, counts, noGuess: true };
}

export const useMinesweeper = create<State>()((set, get) => {
  const prefLevel = store.get<Level>(PREF_KEY, 'easy');
  const level: Level = LEVELS[prefLevel] ? prefLevel : 'easy';

  function persist() {
    const s = get();
    if (!s.layout || s.status !== 'playing') {
      store.remove(SAVE_KEY);
      clearProgress('minesweeper');
      return;
    }
    store.set(SAVE_KEY, {
      level: s.level,
      mines: Array.from(s.layout.mines),
      revealed: Array.from(s.revealed),
      flagged: Array.from(s.flagged),
      elapsedMs: s.elapsedMs,
    } satisfies Saved);
    const opened = s.revealed.reduce((a, b) => a + b, 0);
    const total = s.layout.cols * s.layout.rows - LEVELS[s.level].mines;
    setProgress('minesweeper', `${LEVELS[s.level].label} · ${opened}/${total}칸`);
  }

  function finish(won: boolean) {
    const s = get();
    if (won) {
      sfx.win();
      const seconds = Math.floor(s.elapsedMs / 1000);
      const label = `${LEVELS[s.level].label} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      submitBest('minesweeper', s.level, s.elapsedMs, label, false);
      submitBest('minesweeper', 'default', s.elapsedMs, label, false);
    } else {
      sfx.lose();
    }
    store.remove(SAVE_KEY);
    clearProgress('minesweeper');
  }

  return {
    level,
    layout: null,
    ...emptyArrays(level),
    status: 'ready',
    flagMode: false,
    exploded: -1,
    elapsedMs: 0,
    version: 0,
    hasSave: loadSaved() !== null,

    minesLeft: () => {
      const s = get();
      const flags = s.flagged.reduce((a, b) => a + b, 0);
      return LEVELS[s.level].mines - flags;
    },

    setLevel: (next) => {
      store.set(PREF_KEY, next);
      store.remove(SAVE_KEY);
      clearProgress('minesweeper');
      set({
        level: next,
        layout: null,
        ...emptyArrays(next),
        status: 'ready',
        exploded: -1,
        elapsedMs: 0,
        version: get().version + 1,
        hasSave: false,
      });
    },

    setFlagMode: (on) => set({ flagMode: on }),

    restart: () => {
      const s = get();
      store.remove(SAVE_KEY);
      clearProgress('minesweeper');
      set({
        layout: null,
        ...emptyArrays(s.level),
        status: 'ready',
        exploded: -1,
        elapsedMs: 0,
        version: s.version + 1,
        hasSave: false,
      });
    },

    resumeSaved: () => {
      const saved = loadSaved();
      if (!saved) return;
      set({
        level: saved.level,
        layout: rebuildLayout(saved.level, saved.mines),
        revealed: Uint8Array.from(saved.revealed),
        flagged: Uint8Array.from(saved.flagged),
        status: 'playing',
        exploded: -1,
        elapsedMs: saved.elapsedMs,
        version: get().version + 1,
        hasSave: false,
      });
    },

    reveal: (i) => {
      const s = get();
      if (s.status === 'won' || s.status === 'lost') return;
      if (s.flagMode) return get().toggleFlag(i);

      /* 첫 클릭에서 보드를 만든다 — 그 자리는 반드시 안전 */
      if (!s.layout) {
        const layout = generate(LEVELS[s.level], i);
        const { revealed, flagged } = emptyArrays(s.level);
        floodReveal(layout, revealed, flagged, i);
        sfx.tap();
        set({ layout, revealed, flagged, status: 'playing', version: s.version + 1 });
        persist();
        return;
      }

      if (s.revealed[i] || s.flagged[i]) return;

      if (s.layout.mines[i]) {
        s.revealed[i] = 1;
        set({ status: 'lost', exploded: i, version: s.version + 1 });
        finish(false);
        return;
      }

      floodReveal(s.layout, s.revealed, s.flagged, i);
      sfx.tap();
      const won = isCleared(s.layout, s.revealed);
      set({ status: won ? 'won' : 'playing', version: s.version + 1 });
      if (won) finish(true); else persist();
    },

    toggleFlag: (i) => {
      const s = get();
      if (!s.layout || s.status !== 'playing' || s.revealed[i]) return;
      s.flagged[i] = s.flagged[i] ? 0 : 1;
      sfx.move();
      set({ version: s.version + 1 });
      persist();
    },

    chord: (i) => {
      const s = get();
      if (!s.layout || s.status !== 'playing') return;
      const targets = chordTargets(s.layout, s.revealed, s.flagged, i);
      if (targets.length === 0) return;

      const boom = targets.find((j) => s.layout!.mines[j]);
      if (boom !== undefined) {
        s.revealed[boom] = 1;
        set({ status: 'lost', exploded: boom, version: s.version + 1 });
        finish(false);
        return;
      }
      for (const j of targets) floodReveal(s.layout, s.revealed, s.flagged, j);
      sfx.tap();
      const won = isCleared(s.layout, s.revealed);
      set({ status: won ? 'won' : 'playing', version: s.version + 1 });
      if (won) finish(true); else persist();
    },

    tick: (ms) => {
      if (get().status !== 'playing') return;
      set({ elapsedMs: ms });
    },
  };
});

export const bestFor = (level: Level) => getBest('minesweeper', level);
export { LEVELS };
