import { BoardState, Difficulty, PieceColor, Position } from './types';
import { checkWin, getValidMoves } from './moves';
import { cloneBoard, isValidPos } from './board';

const DIRS: [number, number][] = [[0,1],[1,0],[1,1],[1,-1]];
const S = { FIVE:100000, OFOUR:10000, FOUR:1000, OTHREE:500, THREE:100, OTWO:50, TWO:10 };

function countLine(board: BoardState, r: number, c: number, color: PieceColor, dr: number, dc: number) {
  let cnt = 0, rr = r + dr, cc = c + dc;
  while (isValidPos(rr, cc) && board[rr][cc] === color) { cnt++; rr += dr; cc += dc; }
  const openFwd = isValidPos(rr, cc) && board[rr][cc] === null;
  rr = r - dr; cc = c - dc;
  const openBck = isValidPos(rr, cc) && board[rr][cc] === null;
  return { cnt, openFwd, openBck };
}

function evalPos(board: BoardState, r: number, c: number, color: PieceColor): number {
  if (checkWin(board, r, c, color)) return S.FIVE;
  let score = 0;
  const opp: PieceColor = color === 'black' ? 'white' : 'black';
  for (const [dr, dc] of DIRS) {
    const { cnt, openFwd, openBck } = countLine(board, r, c, color, dr, dc);
    if (cnt >= 4)                          score += S.FIVE;
    else if (cnt === 3 && openFwd && openBck) score += S.OFOUR;
    else if (cnt === 3)                    score += S.FOUR;
    else if (cnt === 2 && openFwd && openBck) score += S.OTHREE;
    else if (cnt === 2)                    score += S.THREE;
    else if (cnt === 1 && openFwd && openBck) score += S.OTWO;
    else if (cnt === 1)                    score += S.TWO;
    const { cnt: oc } = countLine(board, r, c, opp, dr, dc);
    if (oc >= 4)      score += S.FIVE * 0.9;
    else if (oc === 3) score += S.FOUR * 0.8;
    else if (oc === 2) score += S.THREE * 0.7;
  }
  score += (14 - Math.abs(r - 7) - Math.abs(c - 7)) * 2;
  return score;
}

function minimax(
  board: BoardState, depth: number, alpha: number, beta: number,
  maxing: boolean, ai: PieceColor
): number {
  const moves = getValidMoves(board).slice(0, 12);
  if (depth === 0 || moves.length === 0) {
    return moves.slice(0, 5).reduce((acc, { row, col }) => {
      const b = cloneBoard(board);
      b[row][col] = ai;
      return acc + evalPos(b, row, col, ai);
    }, 0);
  }
  const cur: PieceColor = maxing ? ai : (ai === 'black' ? 'white' : 'black');
  let best = maxing ? -Infinity : Infinity;
  for (const { row, col } of moves) {
    const nb = cloneBoard(board);
    nb[row][col] = cur;
    if (checkWin(nb, row, col, cur)) return maxing ? 100000 : -100000;
    const v = minimax(nb, depth - 1, alpha, beta, !maxing, ai);
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else        { best = Math.min(best, v); beta  = Math.min(beta, v);  }
    if (beta <= alpha) break;
  }
  return best;
}

export function getBestMove(board: BoardState, ai: PieceColor, difficulty: Difficulty): Position | null {
  const moves = getValidMoves(board);
  if (!moves.length) return null;
  if (difficulty === 'easy') return moves[Math.floor(Math.random() * moves.length)];
  const depth = difficulty === 'normal' ? 3 : 5;
  const limit = difficulty === 'normal' ? 10 : 20;
  let best = moves[0];
  let bestVal = -Infinity;
  for (const { row, col } of moves.slice(0, limit)) {
    const nb = cloneBoard(board);
    nb[row][col] = ai;
    const v = minimax(nb, depth - 1, -Infinity, Infinity, false, ai);
    if (v > bestVal) { bestVal = v; best = { row, col }; }
  }
  return best;
}
