import { describe, it, expect } from 'vitest';
import {
  Cell, LEVELS, cluesOf, generate, isSolved, lineDone, lineSolvable, solveLine,
} from '../src/games/nonogram/engine';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const unknown = (n: number): Cell[] => new Array(n).fill(-1) as Cell[];

describe('힌트 뽑기', () => {
  it('연속한 칸을 세어 준다', () => {
    expect(cluesOf([1, 1, 0, 1, 0])).toEqual([2, 1]);
    expect(cluesOf([0, 0, 0])).toEqual([0]);
    expect(cluesOf([1, 1, 1])).toEqual([3]);
    expect(cluesOf([1, 0, 1, 0, 1])).toEqual([1, 1, 1]);
  });
});

describe('줄 풀이', () => {
  it('꽉 찬 줄은 바로 확정된다', () => {
    expect(solveLine(unknown(5), [5])).toEqual([1, 1, 1, 1, 1]);
  });

  it('빈 줄도 확정된다', () => {
    expect(solveLine(unknown(5), [0])).toEqual([0, 0, 0, 0, 0]);
  });

  it('겹치는 부분만 확정한다', () => {
    /* 길이 5에 블록 3 → 가운데 한 칸은 반드시 칠해진다 */
    expect(solveLine(unknown(5), [3])).toEqual([-1, -1, 1, -1, -1]);
  });

  it('이미 아는 칸을 반영한다', () => {
    const cells: Cell[] = [-1, -1, -1, -1, -1];
    cells[0] = 1;
    expect(solveLine(cells, [3])).toEqual([1, 1, 1, 0, 0]);
  });

  it('여러 블록도 처리한다', () => {
    expect(solveLine(unknown(5), [2, 2])).toEqual([1, 1, 0, 1, 1]);
  });

  it('모순이면 null', () => {
    const cells: Cell[] = [0, 0, 0, 0, 0];
    expect(solveLine(cells, [3])).toBeNull();
  });

  it('정답 줄을 그대로 받으면 그대로 돌려준다', () => {
    const line: Cell[] = [1, 0, 1, 1, 0];
    expect(solveLine(line, cluesOf(line))).toEqual(line);
  });
});

describe('문제 생성', () => {
  it('만들어진 문제는 줄 논리만으로 전부 풀린다', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const puzzle = generate(LEVELS[level], rng(level.length * 13 + 5));
      expect(lineSolvable(puzzle.size, puzzle.rowClues, puzzle.colClues)).toBe(true);
    }
  });

  it('힌트가 정답과 맞는다', () => {
    const puzzle = generate(LEVELS.normal, rng(77));
    const { size, solution, rowClues, colClues } = puzzle;
    for (let r = 0; r < size; r++) {
      expect(rowClues[r]).toEqual(cluesOf(Array.from({ length: size }, (_, c) => solution[r * size + c])));
    }
    for (let c = 0; c < size; c++) {
      expect(colClues[c]).toEqual(cluesOf(Array.from({ length: size }, (_, r) => solution[r * size + c])));
    }
  });

  it('너무 비거나 너무 꽉 찬 문제는 내보내지 않는다', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const puzzle = generate(LEVELS.normal, rng(seed * 3));
      const filled = puzzle.solution.reduce((a, b) => a + b, 0);
      expect(filled).toBeGreaterThanOrEqual(puzzle.solution.length * 0.3);
      expect(filled).toBeLessThanOrEqual(puzzle.solution.length * 0.8);
    }
  });
});

describe('정답 판정', () => {
  it('칠한 칸이 정답과 같으면 완성', () => {
    const puzzle = generate(LEVELS.easy, rng(2));
    const marks = new Int8Array(puzzle.solution.length);
    expect(isSolved(puzzle, marks)).toBe(false);
    for (let i = 0; i < marks.length; i++) marks[i] = puzzle.solution[i] ? 1 : 0;
    expect(isSolved(puzzle, marks)).toBe(true);
  });

  it('X 표시는 정답 판정에 영향을 주지 않는다', () => {
    const puzzle = generate(LEVELS.easy, rng(4));
    const marks = new Int8Array(puzzle.solution.length);
    for (let i = 0; i < marks.length; i++) marks[i] = puzzle.solution[i] ? 1 : -1;
    expect(isSolved(puzzle, marks)).toBe(true);
  });

  it('줄 완성 여부를 알려 준다', () => {
    const puzzle = generate(LEVELS.easy, rng(6));
    const marks = new Int8Array(puzzle.solution.length);
    for (let c = 0; c < puzzle.size; c++) marks[c] = puzzle.solution[c] ? 1 : 0;
    expect(lineDone(puzzle, marks, 0, true)).toBe(true);
    expect(lineDone(puzzle, marks, 1, true)).toBe(false);
  });
});
