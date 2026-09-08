import { shuffle, shuffledIndices } from "./rng.js";
import { isValid } from "./validator.js";
import { hasUniqueSolution, solve } from "./solver.js";

export type Difficulty = "easy" | "medium" | "hard";

const CLUE_RANGE: Record<Difficulty, [number, number]> = {
  easy:   [40, 45],
  medium: [32, 36],
  hard:   [26, 30],
};

/** 완성된 스도쿠 보드(81칸) 생성. */
function generateFullBoard(rand?: () => number): number[] {
  const board = new Array<number>(81).fill(0);

  // 첫 행을 랜덤 순열로 채워 속도 향상
  const firstRow = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand);
  for (let i = 0; i < 9; i++) board[i] = firstRow[i];

  fillBoard(board, rand);
  return board;
}

function fillBoard(board: number[], rand?: () => number): boolean {
  const idx = board.indexOf(0);
  if (idx === -1) return true;
  const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rand);
  for (const n of nums) {
    if (isValid(board, idx, n)) {
      board[idx] = n;
      if (fillBoard(board, rand)) return true;
      board[idx] = 0;
    }
  }
  return false;
}

/** 완성 보드에서 구멍을 뚫어 퍼즐 생성. 유일 해 보장. */
function digHoles(solution: number[], targetClues: number, rand?: () => number): number[] {
  const puzzle = solution.slice();
  const order = shuffledIndices(81, rand);
  let filled = 81;

  for (const idx of order) {
    if (filled <= targetClues) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;

    if (!hasUniqueSolution(puzzle)) {
      puzzle[idx] = backup;
    } else {
      filled--;
    }
  }
  return puzzle;
}

/**
 * 난이도에 따른 스도쿠 퍼즐 및 솔루션 생성.
 * rand를 주면 같은 시드에서 항상 같은 문제가 나온다(오늘의 문제용).
 */
export function generatePuzzle(difficulty: Difficulty, rand?: () => number): {
  puzzle: number[];
  solution: number[];
  clues: number;
} {
  const [min, max] = CLUE_RANGE[difficulty];
  const roll = rand ?? Math.random;
  const targetClues = min + Math.floor(roll() * (max - min + 1));

  const solution = generateFullBoard(rand);
  const puzzle = digHoles(solution, targetClues, rand);

  // solver로 완전한 해 배열 반환 (정답 검증용)
  const solverBoard = puzzle.slice();
  solve(solverBoard);

  return {
    puzzle,
    solution: solverBoard,
    clues: puzzle.filter((v) => v !== 0).length,
  };
}
