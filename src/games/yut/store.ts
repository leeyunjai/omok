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
/** 윷가락이 구르다 멎을 때까지 — yut.css의 ytTumble과 맞춘다 */
export const THROW_ANIM = 780;
/** 윷·모가 계속 나올 때 무한 루프를 막는다 */
const MAX_PENDING = 8;

export type Mode = 'vs-ai' | 'vs-human';
export type Phase = 'menu' | 'throwing' | 'moving' | 'ended';

/** 방금 벌어진 일을 판 위에 잠깐 표시한다 */
export interface Fx {
  id: number;
  node: string;
  kind: 'capture' | 'finish';
}

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
  /** 방금 던진 결과 */
  lastThrow: Throw | null;
  /** 윷가락 네 개의 상태 — true면 배(평평한 면)가 위 */
  sticks: boolean[];
  /** 던질 때마다 늘어난다. 연출을 다시 재생하는 키로 쓴다 */
  throwId: number;
  /** 윷가락이 아직 구르는 중 */
  rolling: boolean;
  /** 윷·모가 나와서 한 번 더 던져야 하는 상태 */
  bonus: boolean;
  fx: Fx | null;
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

const sideName = (p: Player) => (p === 'blue' ? '청' : '홍');

export const useYut = create<State>()((set, get) => {
  const prefs: Prefs = {
    difficulty: 'normal',
    playerSide: 'blue',
    ...store.get<Partial<Prefs>>(PREF_KEY, {}),
  };

  let fxId = 0;
  let fxTimer: ReturnType<typeof setTimeout> | null = null;

  function showFx(node: string, kind: Fx['kind']) {
    if (fxTimer) clearTimeout(fxTimer);
    set({ fx: { id: ++fxId, node, kind } });
    fxTimer = setTimeout(() => set({ fx: null }), 900);
  }

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
    set({ game: next, phase: 'throwing', selected: null, bonus: false });
    persist();
    if (!isMyTurn()) scheduleAi();
  }

  function scheduleAi() {
    const s = get();
    if (s.phase === 'ended' || s.mode !== 'vs-ai') return;
    set({ aiThinking: true });
    setTimeout(() => {
      const cur = get();
      if (cur.phase === 'ended' || cur.phase === 'menu' || cur.game.turn === cur.playerSide) {
        set({ aiThinking: false });
        return;
      }
      if (cur.phase === 'throwing') { set({ aiThinking: false }); get().rollDice(); return; }
      const move = pickMove(cur.game, cur.difficulty);
      set({ aiThinking: false });
      if (!move) { finishTurn(); return; }
      get().playMove(move);
    }, AI_DELAY);
  }

  /** 윷가락이 멎은 다음 — 결과를 판에 반영한다 */
  function settleThrow(result: Throw, id: number) {
    const s = get();
    /* 구르는 사이에 메뉴로 나갔거나 다시 던졌다면 버린다 */
    if (s.throwId !== id || s.phase === 'menu' || s.phase === 'ended') return;

    const pending = [...s.game.pending, result];
    const game = { ...s.game, pending };
    const who = sideName(s.game.turn);
    const label = THROW_LABEL[result];
    const again = isBonusThrow(result) && pending.length < MAX_PENDING;

    const log = [`${who} ${label}${again ? ' — 한 번 더' : ''}`, ...s.log].slice(0, 8);

    if (again) {
      sfx.levelUp();
      set({
        game, log, rolling: false, bonus: true,
        phase: 'throwing',
        message: `${label}! 한 번 더 던지세요`,
      });
      persist();
      if (!isMyTurn()) scheduleAi();
      return;
    }

    const all = pending.map((t) => THROW_LABEL[t]).join(' + ');
    if (legalMoves(game).length === 0) {
      set({
        game: { ...game, pending: [], turn: other(game.turn) },
        log, rolling: false, bonus: false,
        phase: 'throwing',
        selected: null,
        message: `${all} — 쓸 수 있는 말이 없어 차례를 넘깁니다`,
      });
      persist();
      if (!isMyTurn()) scheduleAi();
      return;
    }

    set({
      game, log, rolling: false, bonus: false,
      phase: 'moving',
      selected: autoSelect(game),
      message: `${all} — 갈 자리를 누르세요`,
    });
    persist();
    if (!isMyTurn()) scheduleAi();
  }

  const fresh = {
    lastThrow: null as Throw | null,
    sticks: [] as boolean[],
    rolling: false,
    bonus: false,
    fx: null as Fx | null,
    selected: null as number | null,
    message: null as string | null,
    log: [] as string[],
  };

  return {
    ...prefs,
    game: createGame(),
    mode: 'vs-ai' as Mode,
    phase: 'menu' as Phase,
    throwId: 0,
    aiThinking: false,
    ...fresh,

    setPref: (patch) => {
      const next = { difficulty: get().difficulty, playerSide: get().playerSide, ...patch };
      store.set(PREF_KEY, next);
      set(next);
    },

    startGame: (mode) => {
      store.remove(SAVE_KEY);
      clearProgress('yut');
      set({ ...fresh, game: createGame('blue'), mode, phase: 'throwing' });
      if (!isMyTurn()) scheduleAi();
    },

    resumeSaved: () => {
      const saved = loadSavedGame();
      if (!saved) return;
      set({
        ...fresh,
        game: saved.game,
        mode: saved.mode,
        difficulty: saved.difficulty,
        playerSide: saved.playerSide,
        phase: saved.game.pending.length > 0 ? 'moving' : 'throwing',
      });
      if (!isMyTurn()) scheduleAi();
    },

    rollDice: () => {
      const s = get();
      if (s.phase !== 'throwing' || s.rolling) return;

      const { result, sticks } = throwYut();
      sfx.drop();
      const id = s.throwId + 1;
      set({ rolling: true, sticks, lastThrow: result, throwId: id, message: null, selected: null });
      setTimeout(() => settleThrow(result, id), THROW_ANIM);
    },

    selectPiece: (pieceId) => set({ selected: pieceId }),

    playMove: (move) => {
      const s = get();
      if (s.phase !== 'moving' || s.rolling) return;

      const res = applyMove(s.game, move);
      if (res.captured > 0) sfx.capture(); else sfx.place();

      const who = sideName(s.game.turn);
      const notes: string[] = [];
      if (res.captured > 0) notes.push(`${res.captured}말 잡음`);
      if (res.finished > 0) notes.push(`${res.finished}말 완주`);
      if (res.captured > 0) showFx(move.to, 'capture');
      else if (res.finished > 0) showFx('o19', 'finish');

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
        /* 잡으면 한 번 더 던진다.
           아직 쓰지 않은 결과는 그대로 남는다 — 여기서 pending을 비우면
           모가 나와 한 번 더 던져 잡았을 때 그 모가 사라진다. */
        const left = res.state.pending.map((t) => THROW_LABEL[t]).join(' + ');
        set({
          game: res.state,
          phase: 'throwing',
          bonus: true,
          selected: null,
          message: left
            ? `${who} 잡았습니다 — 한 번 더 던지세요 (남은 결과 ${left})`
            : `${who} 잡았습니다 — 한 번 더 던지세요`,
        });
        persist();
        if (!isMyTurn()) scheduleAi();
        return;
      }
      finishTurn();
    },

    goToMenu: () => set({ ...fresh, phase: 'menu', aiThinking: false }),

    restart: () => {
      const s = get();
      set({ ...fresh, game: createGame('blue'), phase: 'throwing' });
      if (s.mode === 'vs-ai' && s.playerSide !== 'blue') scheduleAi();
    },
  };
});

export const movesForPiece = (game: GameState, pieceId: number): Move[] =>
  legalMoves(game).filter((m) => m.pieceId === pieceId);

export type { Piece };
