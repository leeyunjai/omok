import { create } from 'zustand';
import {
  Dir, Tile, adoptIds, canMove, hasWon, maxTile, move, newGame, spawn,
} from './engine';
import { createStore } from '../../shared/storage';
import { setProgress, clearProgress } from '../../shared/progress';
import { getBest, submitBest } from '../../shared/records';
import { sfx } from '../../shared/sound';

const store = createStore('g2048');
const SAVE_KEY = 'game';

export type Status = 'playing' | 'won' | 'over';

interface Snapshot {
  tiles: Tile[];
  score: number;
}

interface Saved extends Snapshot {
  keepGoing: boolean;
}

interface State {
  tiles: Tile[];
  /** 합쳐지며 사라지는 중인 타일 (연출용) */
  fading: Tile[];
  score: number;
  status: Status;
  /** 2048을 넘긴 뒤에도 계속하는 중인지 */
  keepGoing: boolean;
  history: Snapshot[];
  version: number;

  slide: (dir: Dir) => void;
  undo: () => void;
  restart: () => void;
  continueGame: () => void;
}

function loadSaved(): Saved | null {
  const s = store.get<Saved | null>(SAVE_KEY, null);
  if (!s || !Array.isArray(s.tiles) || s.tiles.length === 0) return null;
  return s;
}

export const use2048 = create<State>()((set, get) => {
  const saved = loadSaved();
  const tiles = saved ? adoptIds(saved.tiles) : newGame();

  function persist() {
    const s = get();
    if (s.status === 'over') {
      store.remove(SAVE_KEY);
      clearProgress('g2048');
      return;
    }
    store.set(SAVE_KEY, { tiles: s.tiles, score: s.score, keepGoing: s.keepGoing } satisfies Saved);
    setProgress('g2048', `${s.score.toLocaleString()}점 · 최고 타일 ${maxTile(s.tiles)}`);
  }

  function record() {
    const s = get();
    submitBest('g2048', 'score', s.score, `${s.score.toLocaleString()}점`, true);
    submitBest('g2048', 'default', s.score, `${s.score.toLocaleString()}점`, true);
  }

  return {
    tiles,
    fading: [],
    score: saved?.score ?? 0,
    status: 'playing',
    keepGoing: saved?.keepGoing ?? false,
    history: [],
    version: 0,

    slide: (dir) => {
      const s = get();
      if (s.status === 'over') return;

      const res = move(s.tiles, dir);
      if (!res.moved) return;

      const before: Snapshot = { tiles: s.tiles, score: s.score };
      const born = spawn(res.tiles);
      const tiles = born ? [...res.tiles, born] : res.tiles;
      const score = s.score + res.gained;
      const won = !s.keepGoing && hasWon(tiles);
      const over = !canMove(tiles);

      if (res.gained > 0) sfx.tap(); else sfx.move();

      set({
        tiles,
        fading: res.removed,
        score,
        history: [...s.history.slice(-19), before],
        status: won ? 'won' : over ? 'over' : 'playing',
        version: s.version + 1,
      });

      /* 사라지는 타일은 미끄러진 뒤에 치운다 */
      setTimeout(() => set({ fading: [] }), 140);

      if (won) sfx.win();
      if (over) { sfx.lose(); record(); }
      record();
      persist();
    },

    undo: () => {
      const s = get();
      const prev = s.history[s.history.length - 1];
      if (!prev) return;
      sfx.undo();
      set({
        tiles: prev.tiles,
        score: prev.score,
        fading: [],
        history: s.history.slice(0, -1),
        status: 'playing',
        version: s.version + 1,
      });
      persist();
    },

    restart: () => {
      store.remove(SAVE_KEY);
      clearProgress('g2048');
      set({
        tiles: newGame(),
        fading: [],
        score: 0,
        status: 'playing',
        keepGoing: false,
        history: [],
        version: get().version + 1,
      });
    },

    continueGame: () => {
      set({ keepGoing: true, status: 'playing' });
      persist();
    },
  };
});

export const bestScore = () => getBest('g2048', 'score');
export { maxTile };
