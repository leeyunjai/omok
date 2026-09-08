/**
 * 노노그램(네모로직) 엔진.
 * 만들어진 문제는 "줄 단위 논리"만으로 끝까지 풀린다 —
 * 즉 답이 하나뿐이고, 찍지 않아도 풀 수 있다.
 */

export type Level = 'easy' | 'normal' | 'hard';

export interface LevelSpec {
  size: number;
  density: number;
  label: string;
}

export const LEVELS: Record<Level, LevelSpec> = {
  easy: { size: 5, density: 0.6, label: '쉬움' },
  normal: { size: 10, density: 0.55, label: '보통' },
  hard: { size: 15, density: 0.55, label: '어려움' },
};

/** -1 모름 · 0 빈칸 · 1 칠함 */
export type Cell = -1 | 0 | 1;

export interface Puzzle {
  size: number;
  /** 정답 (1 = 칠하는 칸) */
  solution: Uint8Array;
  rowClues: number[][];
  colClues: number[][];
}

/** 한 줄의 정답에서 힌트 숫자를 뽑는다 */
export function cluesOf(line: ArrayLike<number>): number[] {
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) run++;
    else if (run) { out.push(run); run = 0; }
  }
  if (run) out.push(run);
  return out.length ? out : [0];
}

/**
 * 한 줄을 최대한 확정한다.
 * 앞에서부터 놓을 수 있는 경우(prefix)와 뒤가 성립하는 경우(suffix)를 각각 계산해
 * 두 조건을 모두 만족하는 배치에서만 나타나는 값을 확정으로 본다.
 * 모순이면 null.
 */
export function solveLine(cells: Cell[], clues: number[]): Cell[] | null {
  const n = cells.length;
  const cl = clues[0] === 0 ? [] : clues;
  const k = cl.length;

  /* suffix[pos][ci] : cells[pos..]에 clues[ci..]를 놓을 수 있는가 */
  const suffix: boolean[][] = Array.from({ length: n + 2 }, () => new Array(k + 1).fill(false));
  for (let pos = n; pos >= 0; pos--) suffix[pos][k] = cells.slice(pos).every((c) => c !== 1);
  for (let ci = k - 1; ci >= 0; ci--) {
    for (let pos = n; pos >= 0; pos--) {
      let ok = false;
      /* 이 칸을 비우고 넘어가기 */
      if (pos < n && cells[pos] !== 1 && suffix[pos + 1][ci]) ok = true;
      /* 이 칸부터 블록 놓기 */
      const len = cl[ci];
      if (!ok && pos + len <= n) {
        let fits = true;
        for (let j = pos; j < pos + len; j++) if (cells[j] === 0) { fits = false; break; }
        if (fits) {
          const after = pos + len;
          if (after === n) fits = ci === k - 1;
          else if (cells[after] === 1) fits = false;
          if (fits) ok = after === n ? true : suffix[after + 1][ci + 1];
        }
      }
      suffix[pos][ci] = ok;
    }
  }
  if (!suffix[0][0] && !(k === 0 && suffix[0][0] === false && cells.every((c) => c !== 1))) {
    if (k === 0) {
      if (!cells.every((c) => c !== 1)) return null;
    } else if (!suffix[0][0]) {
      return null;
    }
  }

  /* 앞에서부터 실제로 도달 가능한 상태만 훑으며 각 칸의 가능한 값을 모은다 */
  const canBe0 = new Array(n).fill(false);
  const canBe1 = new Array(n).fill(false);
  const reach: boolean[][] = Array.from({ length: n + 2 }, () => new Array(k + 1).fill(false));
  reach[0][0] = true;

  for (let pos = 0; pos <= n; pos++) {
    for (let ci = 0; ci <= k; ci++) {
      if (!reach[pos][ci]) continue;
      if (pos === n) continue;

      /* 빈칸으로 두기 */
      if (cells[pos] !== 1 && suffix[pos + 1][ci]) {
        canBe0[pos] = true;
        reach[pos + 1][ci] = true;
      }
      /* 블록 놓기 */
      if (ci < k) {
        const len = cl[ci];
        if (pos + len <= n) {
          let fits = true;
          for (let j = pos; j < pos + len; j++) if (cells[j] === 0) { fits = false; break; }
          const after = pos + len;
          if (fits && after < n && cells[after] === 1) fits = false;
          if (fits) {
            const restOk = after === n ? ci === k - 1 : suffix[after + 1][ci + 1];
            if (restOk) {
              for (let j = pos; j < after; j++) canBe1[j] = true;
              if (after < n) {
                canBe0[after] = true;
                reach[after + 1][ci + 1] = true;
              } else {
                reach[after][ci + 1] = true;
              }
            }
          }
        }
      }
    }
  }

  const out: Cell[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (canBe0[i] && canBe1[i]) out[i] = -1;
    else if (canBe1[i]) out[i] = 1;
    else if (canBe0[i]) out[i] = 0;
    else return null;
  }
  return out;
}

/** 힌트만 보고 줄 단위 규칙으로 끝까지 풀리는지 확인한다 */
export function lineSolvable(size: number, rowClues: number[][], colClues: number[][]): boolean {
  const grid: Cell[] = new Array(size * size).fill(-1);

  for (;;) {
    let progress = false;

    for (let r = 0; r < size; r++) {
      const line: Cell[] = [];
      for (let c = 0; c < size; c++) line.push(grid[r * size + c]);
      const solved = solveLine(line, rowClues[r]);
      if (!solved) return false;
      for (let c = 0; c < size; c++) {
        if (solved[c] !== line[c]) { grid[r * size + c] = solved[c]; progress = true; }
      }
    }

    for (let c = 0; c < size; c++) {
      const line: Cell[] = [];
      for (let r = 0; r < size; r++) line.push(grid[r * size + c]);
      const solved = solveLine(line, colClues[c]);
      if (!solved) return false;
      for (let r = 0; r < size; r++) {
        if (solved[r] !== line[r]) { grid[r * size + c] = solved[r]; progress = true; }
      }
    }

    if (!progress) break;
  }

  return grid.every((v) => v !== -1);
}

function cluesFromGrid(solution: Uint8Array, size: number) {
  const rowClues: number[][] = [];
  const colClues: number[][] = [];
  for (let r = 0; r < size; r++) {
    rowClues.push(cluesOf(Array.from({ length: size }, (_, c) => solution[r * size + c])));
  }
  for (let c = 0; c < size; c++) {
    colClues.push(cluesOf(Array.from({ length: size }, (_, r) => solution[r * size + c])));
  }
  return { rowClues, colClues };
}

/** 줄 논리만으로 풀리는 문제를 만들어 낸다 */
export function generate(spec: LevelSpec, rand: () => number = Math.random, maxAttempts = 300): Puzzle {
  const { size, density } = spec;
  let fallback: Puzzle | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = new Uint8Array(size * size);
    for (let i = 0; i < solution.length; i++) solution[i] = rand() < density ? 1 : 0;

    /* 빈 줄만 잔뜩 있는 문제는 재미가 없다 */
    let filled = 0;
    for (const v of solution) filled += v;
    if (filled < solution.length * 0.3 || filled > solution.length * 0.8) continue;

    const { rowClues, colClues } = cluesFromGrid(solution, size);
    const puzzle: Puzzle = { size, solution, rowClues, colClues };
    if (!fallback) fallback = puzzle;
    if (lineSolvable(size, rowClues, colClues)) return puzzle;
  }

  return fallback ?? { size, solution: new Uint8Array(size * size), rowClues: [], colClues: [] };
}

/** 칠한 칸이 정답과 완전히 같은지 (X 표시는 무시) */
export function isSolved(puzzle: Puzzle, marks: Int8Array): boolean {
  for (let i = 0; i < puzzle.solution.length; i++) {
    const filled = marks[i] === 1 ? 1 : 0;
    if (filled !== puzzle.solution[i]) return false;
  }
  return true;
}

/** 그 줄이 정답대로 다 채워졌는지 — 힌트 숫자를 흐리게 만들 때 쓴다 */
export function lineDone(puzzle: Puzzle, marks: Int8Array, index: number, isRow: boolean): boolean {
  const { size, solution } = puzzle;
  for (let i = 0; i < size; i++) {
    const idx = isRow ? index * size + i : i * size + index;
    const filled = marks[idx] === 1 ? 1 : 0;
    if (filled !== solution[idx]) return false;
  }
  return true;
}
