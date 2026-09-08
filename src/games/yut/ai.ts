import {
  GameState, Move, Piece, Player, Throw, applyMove, distanceToGoal, legalMoves, other,
  piecesAt, targetOf,
} from './engine';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: '쉬움', normal: '보통', hard: '어려움',
};

/** 윷 결과가 나올 확률 — 잡힐 위험을 셀 때 쓴다 */
const THROW_ODDS: Partial<Record<Throw, number>> = {
  do: 4 / 16, gae: 6 / 16, geol: 4 / 16, yut: 1 / 16, mo: 1 / 16,
};

/** 그 말이 다음 차례에 잡힐 만한 정도 (0~1 근처) */
function riskAt(state: GameState, node: string, owner: Player): number {
  if (node === 'goal' || node === 'start') return 0;
  const enemy = other(owner);
  let risk = 0;
  for (const p of state.pieces) {
    if (p.done || p.owner !== enemy) continue;
    for (const [t, odds] of Object.entries(THROW_ODDS) as [Throw, number][]) {
      const target = simulateTarget(p.node, t);
      if (target === node) risk += odds;
    }
  }
  return risk;
}

/** targetOf는 말의 위치만 보므로 임시 말로 계산해도 된다 */
function simulateTarget(from: string, t: Throw): string | null {
  const fake: Piece = { id: -1, owner: 'blue', node: from, stack: 1, done: false };
  return targetOf(fake, t);
}

/** 수 하나의 값어치 */
export function scoreMove(state: GameState, move: Move): number {
  const me = state.turn;
  const piece = state.pieces.find((p) => p.id === move.pieceId)!;

  let score = 0;
  /* 잡기가 가장 크다 — 상대는 처음부터 다시 와야 하고 나는 한 번 더 던진다 */
  score += move.captures * 60;
  if (move.finishes) score += 45;

  /* 진척도 */
  const before = distanceToGoal(piece.node);
  const after = distanceToGoal(move.to);
  score += (before - after) * 4;

  /* 지름길 입구에 서는 건 그 자체로 이득 */
  if (move.to === 'o4') score += 8;
  if (move.to === 'o9') score += 14;
  if (move.to === 'center') score += 10;

  /* 업기는 효율적이지만 한 번에 다 잡히는 위험도 같이 커진다 */
  const groupSize = piecesAt(state, piece.node, me).length + move.stacksWith;
  if (move.stacksWith > 0) score += 6;

  const risk = riskAt(state, move.to, me);
  score -= risk * 22 * Math.max(1, groupSize * 0.8);

  return score;
}

export function pickMove(state: GameState, difficulty: Difficulty): Move | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  if (difficulty === 'easy') {
    /* 잡을 수 있으면 잡되, 나머지는 아무거나 */
    const capture = moves.find((m) => m.captures > 0);
    if (capture && Math.random() < 0.6) return capture;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const scored = moves.map((m) => ({ m, v: scoreMove(state, m) }));

  if (difficulty === 'hard') {
    /* 한 수 뒤 상대가 바로 잡을 수 있는지까지 본다 */
    for (const entry of scored) {
      const after = applyMove(state, entry.m).state;
      let worst = 0;
      for (const p of after.pieces) {
        if (p.done || p.owner !== state.turn) continue;
        worst = Math.max(worst, riskAt(after, p.node, state.turn) * p.stack);
      }
      entry.v -= worst * 10;
    }
  }

  scored.sort((a, b) => b.v - a.v);
  return scored[0].m;
}
