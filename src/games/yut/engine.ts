/**
 * 윷놀이 규칙 엔진.
 * 판은 바깥 20칸 + 지름길(중앙을 지나는 두 대각선)로 이루어진 그래프다.
 * 지름길은 "모서리에 정확히 멈췄을 때"만 탈 수 있고,
 * 중앙에 정확히 멈추면 참먹이(도착) 쪽으로 빠진다 — 실제 규칙 그대로다.
 */

export type Player = 'blue' | 'red';
export const other = (p: Player): Player => (p === 'blue' ? 'red' : 'blue');

/** 윷가락 결과 */
export type Throw = 'backdo' | 'do' | 'gae' | 'geol' | 'yut' | 'mo';

export const THROW_STEPS: Record<Throw, number> = {
  backdo: -1, do: 1, gae: 2, geol: 3, yut: 4, mo: 5,
};
export const THROW_LABEL: Record<Throw, string> = {
  backdo: '뒤도', do: '도', gae: '개', geol: '걸', yut: '윷', mo: '모',
};
/** 윷·모는 한 번 더 던진다 */
export const isBonusThrow = (t: Throw) => t === 'yut' || t === 'mo';

export const GOAL = 'goal';
export const START = 'start';

/** 바깥 20칸 + 지름길 8칸 + 중앙 */
export const OUTER_COUNT = 20;
const outer = (i: number) => `o${i}`;

/**
 * 다음 칸.
 *  - 지름길은 그 모서리에서 "출발"할 때만 탄다. 지나가기만 하면 바깥 길로 간다.
 *  - 중앙도 마찬가지로, 멈췄다가 출발하면 참먹이 쪽으로 빠지고,
 *    위쪽 지름길에서 지나가는 중이면 반대편 모서리로 나간다.
 *
 * @param fromStart 이 칸이 이번 이동의 출발점인지
 */
export function nextNode(node: string, cameFrom: string | null, fromStart = false): string {
  if (node === START) return outer(0);
  if (node === GOAL) return GOAL;

  if (node === 'center') return !fromStart && cameFrom === 'a2' ? 'b1' : 'd1';
  if (node === 'a1') return 'a2';
  if (node === 'a2') return 'center';
  if (node === 'b1') return 'b2';
  if (node === 'b2') return outer(14);
  if (node === 'c1') return 'c2';
  if (node === 'c2') return 'center';
  if (node === 'd1') return 'd2';
  if (node === 'd2') return GOAL;

  const i = Number(node.slice(1));
  /* 모서리에 멈춰 있던 말만 지름길로 들어간다 */
  if (i === 4 && fromStart) return 'a1';
  if (i === 9 && fromStart) return 'c1';
  if (i >= OUTER_COUNT - 1) return GOAL;
  return outer(i + 1);
}

/** 어떤 칸에서 앞으로 나아가는 순서 */
export function route(from: string, maxSteps: number): string[] {
  const out: string[] = [];
  let cur = from;
  let prev: string | null = null;
  for (let i = 0; i < maxSteps; i++) {
    const nxt = nextNode(cur, prev, i === 0);
    out.push(nxt);
    if (nxt === GOAL) break;
    prev = cur;
    cur = nxt;
  }
  return out;
}

/** 뒤도 — 한 칸 뒤로. 바깥 길에서만 의미가 있고, 출발점 앞이면 그대로 둔다. */
export function backNode(node: string): string {
  if (node === START || node === GOAL) return node;
  if (node === 'a1') return outer(4);
  if (node === 'a2') return 'a1';
  if (node === 'center') return 'a2';
  if (node === 'b1') return 'center';
  if (node === 'b2') return 'b1';
  if (node === 'c1') return outer(9);
  if (node === 'c2') return 'c1';
  if (node === 'd1') return 'center';
  if (node === 'd2') return 'd1';
  const i = Number(node.slice(1));
  if (i === 14) return 'b2';
  if (i <= 0) return START;
  return outer(i - 1);
}

export interface Piece {
  id: number;
  owner: Player;
  node: string;
  /** 업힌 말 수 (자기 자신 포함) */
  stack: number;
  done: boolean;
}

export interface GameState {
  pieces: Piece[];
  turn: Player;
  /** 아직 쓰지 않은 던지기 결과 */
  pending: Throw[];
  winner: Player | null;
}

export const PIECES_PER_SIDE = 4;

export function createGame(first: Player = 'blue'): GameState {
  const pieces: Piece[] = [];
  let id = 1;
  for (const owner of ['blue', 'red'] as Player[]) {
    for (let i = 0; i < PIECES_PER_SIDE; i++) {
      pieces.push({ id: id++, owner, node: START, stack: 1, done: false });
    }
  }
  return { pieces, turn: first, pending: [], winner: null };
}

/** 윷가락 네 개를 던진다. 표시된 가락 하나가 유일하게 뒤집히면 뒤도. */
export function throwYut(rand: () => number = Math.random): { result: Throw; sticks: boolean[] } {
  /* true = 배(평평한 면)가 위 */
  const sticks = Array.from({ length: 4 }, () => rand() < 0.5);
  const flats = sticks.filter(Boolean).length;
  if (flats === 0) return { result: 'mo', sticks };
  if (flats === 4) return { result: 'yut', sticks };
  if (flats === 1) {
    /* 0번 가락이 표시된 가락 — 그것만 배가 위면 뒤도 */
    return { result: sticks[0] ? 'backdo' : 'do', sticks };
  }
  if (flats === 2) return { result: 'gae', sticks };
  return { result: 'geol', sticks };
}

/** 그 칸에 있는 말들 */
export const piecesAt = (state: GameState, node: string, owner?: Player) =>
  state.pieces.filter((p) => !p.done && p.node === node && (owner ? p.owner === owner : true));

/** 판 위(출발점 제외)에 있는 말 */
export const piecesOnBoard = (state: GameState, node: string, owner?: Player) =>
  node === START || node === GOAL ? [] : piecesAt(state, node, owner);

export interface Move {
  pieceId: number;
  throw: Throw;
  to: string;
  /** 잡히는 상대 말 수 */
  captures: number;
  /** 함께 업히는 내 말 수 */
  stacksWith: number;
  finishes: boolean;
}

/** 한 말이 이 결과로 갈 수 있는 자리 */
export function targetOf(piece: Piece, t: Throw): string | null {
  if (piece.done) return null;
  const steps = THROW_STEPS[t];

  if (steps < 0) {
    /* 출발점에 있는 말은 뒤도로 움직이지 않는다 */
    if (piece.node === START) return null;
    return backNode(piece.node);
  }
  const path = route(piece.node, steps);
  if (path.length === 0) return null;
  /* 칸을 넘겨도 도착으로 인정한다 */
  return path.length < steps ? GOAL : path[path.length - 1];
}

export function legalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const seen = new Set<string>();

  for (const t of new Set(state.pending)) {
    for (const piece of state.pieces) {
      if (piece.owner !== state.turn || piece.done) continue;
      /* 같은 칸의 말은 대표 하나만 움직인다 (출발점 대기 말도 마찬가지) */
      const key = `${t}:${piece.node}`;
      const to = targetOf(piece, t);
      if (!to) continue;
      if (seen.has(key)) continue;
      seen.add(key);

      const enemies = piecesOnBoard(state, to, other(piece.owner));
      const friends = piecesOnBoard(state, to, piece.owner);
      moves.push({
        pieceId: piece.id,
        throw: t,
        to,
        captures: enemies.reduce((a, p) => a + p.stack, 0),
        stacksWith: friends.reduce((a, p) => a + p.stack, 0),
        finishes: to === GOAL,
      });
    }
  }
  return moves;
}

export interface ApplyResult {
  state: GameState;
  captured: number;
  finished: number;
  /** 잡았거나 윷·모라서 한 번 더 던지는지 */
  extraTurn: boolean;
}

/** 수를 적용한다. 잡으면 한 번 더 던진다. */
export function applyMove(state: GameState, move: Move): ApplyResult {
  const next: GameState = {
    ...state,
    pieces: state.pieces.map((p) => ({ ...p })),
    pending: [...state.pending],
  };

  const idx = next.pending.indexOf(move.throw);
  if (idx >= 0) next.pending.splice(idx, 1);

  const piece = next.pieces.find((p) => p.id === move.pieceId)!;
  /* 판 위에서 같은 칸에 있는 내 말은 함께 움직인다(업기).
     출발점에서 기다리는 말은 업힌 게 아니므로 하나씩 들어간다. */
  const group = piece.node === START
    ? [piece]
    : next.pieces.filter((p) => !p.done && p.owner === piece.owner && p.node === piece.node);

  let captured = 0;
  if (move.to !== GOAL) {
    for (const enemy of next.pieces) {
      if (enemy.done || enemy.owner === piece.owner || enemy.node !== move.to) continue;
      captured += enemy.stack;
      enemy.node = START;
      enemy.stack = 1;
    }
  }

  let finished = 0;
  for (const p of group) {
    if (move.to === GOAL) {
      p.done = true;
      p.node = GOAL;
      finished += 1;
    } else {
      p.node = move.to;
    }
  }

  /* 업힌 무리의 크기를 다시 센다 (출발점은 무리가 아니다) */
  for (const p of next.pieces) {
    if (p.done || p.node === START) { p.stack = 1; continue; }
    p.stack = next.pieces.filter((q) => !q.done && q.owner === p.owner && q.node === p.node).length;
  }

  const doneCount = next.pieces.filter((p) => p.owner === piece.owner && p.done).length;
  if (doneCount >= PIECES_PER_SIDE) next.winner = piece.owner;

  /* 잡으면 한 번 더 던진다 — 차례를 넘길지는 호출한 쪽이 정한다 */
  return { state: next, captured, finished, extraTurn: captured > 0 };
}

/** 남은 결과로 둘 수 있는 수가 없으면 차례가 넘어간다 */
export const stuck = (state: GameState) => state.pending.length > 0 && legalMoves(state).length === 0;

/** 도착까지 남은 칸 수 — AI가 진척도를 잴 때 쓴다 */
export function distanceToGoal(node: string): number {
  if (node === GOAL) return 0;
  if (node === START) return 21;
  let cur = node;
  let prev: string | null = null;
  for (let i = 1; i <= 40; i++) {
    const nxt = nextNode(cur, prev, i === 1);
    if (nxt === GOAL) return i;
    prev = cur;
    cur = nxt;
  }
  return 40;
}
