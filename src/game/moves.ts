import { BoardState, PieceColor, Position } from './types';
import { BOARD_SIZE, isValidPos } from './board';

const WIN = 5;

function countDir(
  board: BoardState,
  row: number, col: number,
  color: PieceColor,
  dr: number, dc: number
): number {
  let n = 0, r = row + dr, c = col + dc;
  while (isValidPos(r, c) && board[r][c] === color) { n++; r += dr; c += dc; }
  return n;
}

export function checkWin(board: BoardState, row: number, col: number, color: PieceColor): boolean {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    if (1 + countDir(board, row, col, color, dr, dc) + countDir(board, row, col, color, -dr, -dc) >= WIN)
      return true;
  }
  return false;
}

export function getValidMoves(board: BoardState): Position[] {
  const near = new Set<string>();
  let hasAny = false;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c]) continue;
      hasAny = true;
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          const nr = r+dr, nc = c+dc;
          if (isValidPos(nr,nc) && !board[nr][nc]) near.add(`${nr},${nc}`);
        }
    }
  }
  if (!hasAny) return [{ row: 7, col: 7 }];
  return [...near].map(s => { const [r,c] = s.split(',').map(Number); return {row:r,col:c}; });
}
