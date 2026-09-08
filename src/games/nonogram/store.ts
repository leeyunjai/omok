import { create } from 'zustand';
import { LEVELS, Level, Puzzle, generate, isSolved } from './engine';
import { createStore } from '../../shared/storage';
import { setProgress, clearProgress } from '../../shared/progress';
import { getBest, submitBest } from '../../shared/records';
import { sfx } from '../../shared/sound';

const store = createStore('nonogram');
const SAVE_KEY = 'game';
const PREF_KEY = 'pref';

/** 0 = 빈칸, 1 = 칠함, -1 = X 표시 */
export type Mark = 0 | 1 | -1;
export type PaintMode = 'fill' | 'cross';
export type Status = 'playing' | 'won';

interface Saved {
  level: Level;
  solution: number[];
  marks: number[];
  elapsedMs: number;
}

interface State {
  level: Level;
  puzzle: Puzzle;
  marks: Int8Array;
  mode: PaintMode;
  status: Status;
  elapsedMs: number;
  version: number;
  undoStack: Int8Array[];

  setLevel: (level: Level) => void;
  setMode: (mode: PaintMode) => void;
  paint: (index: number, value: Mark) => void;
  beginStroke: () => void;
  undo: () => void;
  newPuzzle: () => void;
  clearMarks: () => void;
  tick: (ms: number) => void;
}

function cluesFrom(solution: Uint8Array, size: number): Puzzle {
  /* 저장본에서 되살릴 때 힌트를 다시 계산한다 */
  const puzzle = { size, solution } as Puzzle;
  const rowClues: number[][] = [];
  const colClues: number[][] = [];
  const runs = (get: (i: number) => number) => {
    const out: number[] = [];
    let run = 0;
    for (let i = 0; i < size; i++) {
      if (get(i) === 1) run++;
      else if (run) { out.push(run); run = 0; }
    }
    if (run) out.push(run);
    return out.length ? out : [0];
  };
  for (let r = 0; r < size; r++) rowClues.push(runs((c) => solution[r * size + c]));
  for (let c = 0; c < size; c++) colClues.push(runs((r) => solution[r * size + c]));
  return { ...puzzle, rowClues, colClues };
}

function loadSaved(): Saved | null {
  const s = store.get<Saved | null>(SAVE_KEY, null);
  if (!s || !LEVELS[s.level] || !Array.isArray(s.solution)) return null;
  const size = LEVELS[s.level].size;
  if (s.solution.length !== size * size) return null;
  return s;
}

export const useNonogram = create<State>()((set, get) => {
  const prefLevel = store.get<Level>(PREF_KEY, 'easy');
  const level: Level = LEVELS[prefLevel] ? prefLevel : 'easy';
  const saved = loadSaved();

  const puzzle = saved
    ? cluesFrom(Uint8Array.from(saved.solution), LEVELS[saved.level].size)
    : generate(LEVELS[level]);
  const marks = saved ? Int8Array.from(saved.marks) : new Int8Array(puzzle.size * puzzle.size);

  function persist() {
    const s = get();
    if (s.status === 'won') {
      store.remove(SAVE_KEY);
      clearProgress('nonogram');
      return;
    }
    store.set(SAVE_KEY, {
      level: s.level,
      solution: Array.from(s.puzzle.solution),
      marks: Array.from(s.marks),
      elapsedMs: s.elapsedMs,
    } satisfies Saved);
    let filled = 0;
    for (const m of s.marks) if (m === 1) filled++;
    setProgress('nonogram', `${LEVELS[s.level].label} · ${filled}칸 칠함`);
  }

  function start(next: Level) {
    const p = generate(LEVELS[next]);
    set({
      level: next,
      puzzle: p,
      marks: new Int8Array(p.size * p.size),
      status: 'playing',
      elapsedMs: 0,
      version: get().version + 1,
      undoStack: [],
    });
    store.set(PREF_KEY, next);
    persist();
  }

  return {
    level: saved ? saved.level : level,
    puzzle,
    marks,
    mode: 'fill',
    status: 'playing',
    elapsedMs: saved ? saved.elapsedMs : 0,
    version: 0,
    undoStack: [],

    setLevel: (next) => start(next),
    newPuzzle: () => start(get().level),
    setMode: (mode) => set({ mode }),

    beginStroke: () => {
      const s = get();
      set({ undoStack: [...s.undoStack.slice(-19), Int8Array.from(s.marks)] });
    },

    paint: (index, value) => {
      const s = get();
      if (s.status !== 'playing') return;
      if (s.marks[index] === value) return;
      s.marks[index] = value;
      const won = isSolved(s.puzzle, s.marks);
      set({ version: s.version + 1, status: won ? 'won' : 'playing' });

      if (won) {
        sfx.win();
        const seconds = Math.floor(s.elapsedMs / 1000);
        const label = `${LEVELS[s.level].label} ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        submitBest('nonogram', s.level, s.elapsedMs, label, false);
        submitBest('nonogram', 'default', s.elapsedMs, label, false);
        store.remove(SAVE_KEY);
        clearProgress('nonogram');
      } else {
        if (value === 1) sfx.tap();
        persist();
      }
    },

    undo: () => {
      const s = get();
      const prev = s.undoStack[s.undoStack.length - 1];
      if (!prev) return;
      sfx.undo();
      set({
        marks: Int8Array.from(prev),
        undoStack: s.undoStack.slice(0, -1),
        status: 'playing',
        version: s.version + 1,
      });
      persist();
    },

    clearMarks: () => {
      const s = get();
      set({
        undoStack: [...s.undoStack.slice(-19), Int8Array.from(s.marks)],
        marks: new Int8Array(s.puzzle.size * s.puzzle.size),
        version: s.version + 1,
      });
      persist();
    },

    tick: (ms) => {
      if (get().status !== 'playing') return;
      set({ elapsedMs: ms });
    },
  };
});

export const bestFor = (level: Level) => getBest('nonogram', level);
export { LEVELS };
