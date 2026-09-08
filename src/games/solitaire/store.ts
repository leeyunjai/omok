import { create } from 'zustand';
import {
  GameState, Source, Target, applyMove, autoCompleteStep, autoTarget,
  canAutoComplete, cardsOf, deal, draw, hasAnyMove, isWon, legalMove,
} from './engine';
import { createStore } from '../../shared/storage';
import { setProgress, clearProgress } from '../../shared/progress';
import { getBest, submitBest } from '../../shared/records';
import { sfx } from '../../shared/sound';

const store = createStore('solitaire');
const SAVE_KEY = 'game';
const PREF_KEY = 'pref';

interface Saved {
  state: GameState;
  elapsedMs: number;
}

interface State {
  game: GameState;
  selected: Source | null;
  status: 'playing' | 'won';
  elapsedMs: number;
  history: GameState[];
  message: string | null;

  select: (src: Source | null) => void;
  tapPile: (dst: Target) => void;
  tapCard: (src: Source) => void;
  drawCard: () => void;
  undo: () => void;
  newGame: (drawCount?: 1 | 3) => void;
  autoComplete: () => void;
  tick: (ms: number) => void;
}

function loadSaved(): Saved | null {
  const s = store.get<Saved | null>(SAVE_KEY, null);
  if (!s || !s.state || !Array.isArray(s.state.tableau)) return null;
  return s;
}

export const useSolitaire = create<State>()((set, get) => {
  const drawPref = store.get<1 | 3>(PREF_KEY, 1);
  const saved = loadSaved();
  const game = saved ? saved.state : deal(drawPref);

  function persist() {
    const s = get();
    if (s.status === 'won') {
      store.remove(SAVE_KEY);
      clearProgress('solitaire');
      return;
    }
    store.set(SAVE_KEY, { state: s.game, elapsedMs: s.elapsedMs } satisfies Saved);
    const done = s.game.foundations.reduce((a, f) => a + f.length, 0);
    setProgress('solitaire', `${done}/52장 · ${s.game.moves}수`);
  }

  function commit(next: GameState) {
    const s = get();
    const won = isWon(next);
    set({
      game: next,
      history: [...s.history.slice(-49), s.game],
      selected: null,
      status: won ? 'won' : 'playing',
      message: null,
    });

    if (won) {
      sfx.win();
      const seconds = Math.floor(s.elapsedMs / 1000);
      const label = `${next.moves}수 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      submitBest('solitaire', 'moves', next.moves, label, false);
      submitBest('solitaire', 'default', next.moves, label, false);
      store.remove(SAVE_KEY);
      clearProgress('solitaire');
      return;
    }
    persist();
  }

  return {
    game,
    selected: null,
    status: isWon(game) ? 'won' : 'playing',
    elapsedMs: saved ? saved.elapsedMs : 0,
    history: [],
    message: null,

    select: (src) => set({ selected: src, message: null }),

    /** 카드를 눌렀을 때 — 고르기, 옮기기, 두 번 누르면 자동 이동 */
    tapCard: (src) => {
      const s = get();
      if (s.status === 'won') return;

      /* 같은 카드를 다시 누르면 자동으로 갈 자리를 찾는다 */
      if (s.selected && sameSource(s.selected, src)) {
        const target = autoTarget(s.game, src);
        if (!target) { set({ selected: null, message: '갈 곳이 없어요' }); return; }
        const next = applyMove(s.game, src, target);
        if (next) { sfx.place(); commit(next); }
        return;
      }

      /* 이미 고른 카드가 있으면 이 자리로 옮겨 본다 */
      if (s.selected && src.type === 'tableau') {
        const dst: Target = { type: 'tableau', pile: src.pile };
        if (legalMove(s.game, s.selected, dst)) {
          const next = applyMove(s.game, s.selected, dst);
          if (next) { sfx.place(); commit(next); return; }
        }
      }
      if (s.selected && src.type === 'foundation') {
        const dst: Target = { type: 'foundation', pile: src.pile };
        if (legalMove(s.game, s.selected, dst)) {
          const next = applyMove(s.game, s.selected, dst);
          if (next) { sfx.place(); commit(next); return; }
        }
      }

      if (cardsOf(s.game, src).length === 0) { set({ selected: null }); return; }
      sfx.tap();
      set({ selected: src, message: null });
    },

    /** 빈 열이나 기초 더미를 눌렀을 때 */
    tapPile: (dst) => {
      const s = get();
      if (!s.selected || s.status === 'won') return;
      const next = applyMove(s.game, s.selected, dst);
      if (!next) { set({ message: '거기엔 놓을 수 없어요' }); return; }
      sfx.place();
      commit(next);
    },

    drawCard: () => {
      const s = get();
      if (s.status === 'won') return;
      const next = draw(s.game);
      if (next === s.game) return;
      sfx.move();
      set({ game: next, history: [...s.history.slice(-49), s.game], selected: null, message: null });
      persist();
    },

    undo: () => {
      const s = get();
      const prev = s.history[s.history.length - 1];
      if (!prev) return;
      sfx.undo();
      set({ game: prev, history: s.history.slice(0, -1), selected: null, status: 'playing', message: null });
      persist();
    },

    newGame: (drawCount) => {
      const s = get();
      const count = drawCount ?? s.game.drawCount;
      store.set(PREF_KEY, count);
      store.remove(SAVE_KEY);
      clearProgress('solitaire');
      set({
        game: deal(count),
        history: [],
        selected: null,
        status: 'playing',
        elapsedMs: 0,
        message: null,
      });
    },

    autoComplete: () => {
      const s = get();
      if (!canAutoComplete(s.game)) return;
      let cur = s.game;
      let step = autoCompleteStep(cur);
      while (step) {
        cur = step;
        step = autoCompleteStep(cur);
      }
      sfx.win();
      commit(cur);
    },

    tick: (ms) => {
      if (get().status !== 'playing') return;
      set({ elapsedMs: ms });
    },
  };
});

function sameSource(a: Source, b: Source): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'tableau' && b.type === 'tableau') return a.pile === b.pile && a.index === b.index;
  if (a.type === 'foundation' && b.type === 'foundation') return a.pile === b.pile;
  return true;
}

export const bestMoves = () => getBest('solitaire', 'moves');
export { canAutoComplete, hasAnyMove };
