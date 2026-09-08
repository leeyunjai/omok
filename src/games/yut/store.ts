import { create } from 'zustand';
import {
  GameState, Move, Piece, Player, Throw, THROW_LABEL, applyMove, createGame,
  isBonusThrow, legalMoves, other, throwYut,
} from './engine';
import { Difficulty, pickMove } from './ai';
import { createStore } from '../../shared/storage';
import { setProgress, clearProgress } from '../../shared/progress';
import { bumpStat } from '../../shared/stats';
import { sfx } from '../../shared/sound';

const store = createStore('yut');
const PREF_KEY = 'pref';
const SAVE_KEY = 'game';
const AI_DELAY = 620;

export type Mode = 'vs-ai' | 'vs-human';
export type Phase = 'menu' | 'throwing' | 'moving' | 'ended';

interface Prefs {
  difficulty: Difficulty;
  playerSide: Player;
}

interface Saved {
  game: GameState;
  mode: Mode;
  difficulty: Difficulty;
  playerSide: Player;
}

interface State extends Prefs {
  game: GameState;
  mode: Mode;
  phase: Phase;
  /** 방금 던진 결과 (연출용) */
  lastThrow: Throw | null;
  sticks: boolean[];
  selected: number | null;
  /** 화면에 띄울 안내 */
  message: string | null;
  aiThinking: boolean;
  log: string[];

  startGame: (mode: Mode) => void;
  resumeSaved: () => void;
  rollDice: () => void;
  selectPiece: (pieceId: number | null) => void;
  playMove: (move: Move) => void;
  goToMenu: () => void;
  restart: () => void;
  setPref: (patch: Partial<Prefs>) => void;
}

export function loadSavedGame(): Saved | null {
  const s = store.get<Saved | null>(SAVE_KEY, null);
  if (!s || !s.game || !Array.isArray(s.game.pieces)) return null;
  return s;
}

export const useYut = create<State>()((set, get) => {
  const prefs: Prefs = {
    difficulty: 'normal',
    playerSide: 'blue',
    ...store.get<Partial<Prefs>>(PREF_KEY, {}),
  };

  function persist() {
    const s = get();
    if (s.phase === 'menu' || s.phase === 'ended') {
      store.remove(SAVE_KEY);
      clearProgress('yut');
      return;
    }
    store.set(SAVE_KEY, {
      game: s.game, mode: s.mode, difficulty: s.difficulty, playerSide: s.playerSide,
    } satisfies Saved);
    const done = s.game.pieces.filter((p) => p.done).length;
    setProgress('yut', `${done}말 완주 · ${s.mode === 'vs-ai' ? 'AI 대전' : '2인'}`);
  }

  /** 움직일 수 있는 말 하나를 미리 골라 둔다 — 출발점 말도 바로 보이게 */
  function autoSelect(game: GameState): number | null {
    const moves = legalMoves(game);
    return moves.length ? moves[0].pieceId : null;
  }

  function isMyTurn(): boolean {
    const s = get();
    return s.mode === 'vs-human' || s.game.turn === s.playerSide;
  }

  function finishTurn() {
    const s = get();
    /* 남은 결과가 있으면 계속 두고, 없으면 차례를 넘긴다 */
    if (s.game.pending.length > 0 && legalMoves(s.game).length > 0) {
      set({ phase: 'moving', selected: autoSelect(s.game) });
      if (!isMyTurn()) scheduleAi();
      return;
    }
    const next = { ...s.game, pending: [], turn: other(s.game.turn) };
    set({ game: next, phase: 'throwing', selected: null });
    persist();
    if (!isMyTurn()) scheduleAi();
  }

  function scheduleAi() {
    const s = get();
    if (s.phase === 'ended' || s.mode !== 'vs-ai') return;
    set({ aiThinking: true });
    setTimeout(() => {
      const cur = get();
      if (cur.phase === 'ended' || cur.game.turn === cur.playerSide) { set({ aiThinking: false }); return; }
      if (cur.game.pending.length === 0) { set({ aiThinking: false }); get().rollDice(); return; }
      const move = pickMove(cur.game, cur.difficulty);
      set({ aiThinking: false });
      if (!move) { finishTurn(); return; }
      get().playMove(move);
    }, AI_DELAY);
  }

  return {
    ...prefs,
    game: createGame(),
    mode: 'vs-ai',
    phase: 'menu',
    lastThrow: null,
    sticks: [],
    selected: null,
    message: null,
    aiThinking: false,
    log: [],

    setPref: (patch) => {
      const next = { difficulty: get().difficulty, playerSide: get().playerSide, ...patch };
      store.set(PREF_KEY, next);
      set(next);
    },

    startGame: (mode) => {
      store.remove(SAVE_KEY);
      clearProgress('yut');
      set({
        game: createGame('blue'),
        mode,
        phase: 'throwing',
        lastThrow: null,
        sticks: [],
        selected: null,
        message: null,
        log: [],
      });
      if (!isMyTurn()) scheduleAi();
    },

    resumeSaved: () => {
      const saved = loadSavedGame();
      if (!saved) return;
      set({
        game: saved.game,
        mode: saved.mode,
        difficulty: saved.difficulty,
        playerSide: saved.playerSide,
        phase: saved.game.pending.length > 0 ? 'moving' : 'throwing',
        selected: null,
        message: null,
        log: [],
      });
      if (!isMyTurn()) scheduleAi();
    },

    rollDice: () => {
      const s = get();
      if (s.phase === 'ended' || s.phase === 'menu') return;
      if (s.game.pending.length > 0) return;

      const { result, sticks } = throwYut();
      sfx.drop();

      const pending = [result];
      /* 윷·모는 한 번 더 — 연달아 나오면 계속 쌓인다 */
      let extra = isBonusThrow(result);
      let guard = 0;
      while (extra && guard++ < 6) {
        const again = throwYut();
        pending.push(again.result);
        extra = isBonusThrow(again.result);
      }

      const game = { ...s.game, pending };
      const label = pending.map((t) => THROW_LABEL[t]).join(' + ');
      const moves = legalMoves(game);

      if (moves.length === 0) {
        /* 쓸 수 있는 수가 없으면 차례가 넘어간다 */
        set({
          game: { ...game, pending: [], turn: other(game.turn) },
          lastThrow: result,
          sticks,
          phase: 'throwing',
          message: `${label} — 움직일 수 있는 말이 없어 차례를 넘깁니다`,
          log: [`${game.turn === 'blue' ? '청' : '홍'} ${label} (통과)`, ...s.log].slice(0, 8),
        });
        persist();
        if (!isMyTurn()) scheduleAi();
        return;
      }

      set({
        game,
        lastThrow: result,
        sticks,
        phase: 'moving',
        selected: autoSelect(game),
        message: `${label} — 갈 자리를 누르세요`,
        log: [`${game.turn === 'blue' ? '청' : '홍'} ${label}`, ...s.log].slice(0, 8),
      });
      persist();
      if (!isMyTurn()) scheduleAi();
    },

    selectPiece: (pieceId) => set({ selected: pieceId, message: null }),

    playMove: (move) => {
      const s = get();
      if (s.phase !== 'moving') return;

      const res = applyMove(s.game, move);
      if (res.captured > 0) sfx.capture(); else sfx.place();

      const who = s.game.turn === 'blue' ? '청' : '홍';
      const notes: string[] = [];
      if (res.captured > 0) notes.push(`${res.captured}말 잡음`);
      if (res.finished > 0) notes.push(`${res.finished}말 완주`);

      set({
        game: res.state,
        selected: autoSelect(res.state),
        message: notes.length ? `${who} ${notes.join(' · ')}` : null,
        log: notes.length ? [`${who} ${notes.join(' · ')}`, ...s.log].slice(0, 8) : s.log,
      });

      if (res.state.winner) {
        sfx.win();
        if (s.mode === 'vs-ai') {
          bumpStat('yut', res.state.winner === s.playerSide ? 'wins' : 'losses');
        }
        store.remove(SAVE_KEY);
        clearProgress('yut');
        set({ phase: 'ended' });
        return;
      }

      if (res.extraTurn) {
        /* 잡으면 한 번 더 던진다 */
        set({ game: { ...res.state, pending: [] }, phase: 'throwing' });
        persist();
        if (!isMyTurn()) scheduleAi();
        return;
      }
      finishTurn();
    },

    goToMenu: () => set({ phase: 'menu', selected: null, aiThinking: false }),

    restart: () => {
      const s = get();
      set({
        game: createGame('blue'),
        phase: 'throwing',
        lastThrow: null,
        sticks: [],
        selected: null,
        message: null,
        log: [],
      });
      if (s.mode === 'vs-ai' && s.playerSide !== 'blue') scheduleAi();
    },
  };
});

export const movesForPiece = (game: GameState, pieceId: number): Move[] =>
  legalMoves(game).filter((m) => m.pieceId === pieceId);

export type { Piece };
