/**
 * 지뢰찾기 규칙 엔진 + "추측 없이 풀리는" 보드 생성기.
 * 흔한 구현과 달리, 만들어진 보드를 솔버로 끝까지 풀어 보고
 * 논리만으로 전부 열리는 배치만 내보낸다. 찍어서 죽는 판이 나오지 않는다.
 */

export type Level = 'easy' | 'normal' | 'hard';

export interface LevelSpec {
  cols: number;
  rows: number;
  mines: number;
  label: string;
}

export const LEVELS: Record<Level, LevelSpec> = {
  easy: { cols: 9, rows: 9, mines: 10, label: '쉬움' },
  normal: { cols: 10, rows: 14, mines: 25, label: '보통' },
  hard: { cols: 12, rows: 18, mines: 50, label: '어려움' },
};

export interface Layout {
  cols: number;
  rows: number;
  /** 지뢰면 1 */
  mines: Uint8Array;
  /** 주변 지뢰 수 */
  counts: Uint8Array;
  /** 추측 없이 풀리는 배치인지 */
  noGuess: boolean;
}

export const idx = (c: number, r: number, cols: number) => r * cols + c;

export function neighbors(i: number, cols: number, rows: number): number[] {
  const c = i % cols;
  const r = Math.floor(i / cols);
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      out.push(nr * cols + nc);
    }
  }
  return out;
}

function countAll(mines: Uint8Array, cols: number, rows: number): Uint8Array {
  const counts = new Uint8Array(mines.length);
  for (let i = 0; i < mines.length; i++) {
    if (mines[i]) continue;
    let n = 0;
    for (const j of neighbors(i, cols, rows)) if (mines[j]) n++;
    counts[i] = n;
  }
  return counts;
}

/**
 * 솔버 — 사람이 쓰는 확정 규칙만 쓴다.
 *  1) 숫자 == 주변 깃발 수  → 나머지 이웃은 안전
 *  2) 숫자 - 깃발 == 남은 미확인 수 → 나머지 이웃은 전부 지뢰
 *  3) 부분집합 규칙 — 한 칸의 미확인 이웃이 다른 칸의 부분집합이면 차집합을 확정
 * 이 규칙만으로 전부 열리면 "추측이 필요 없는 판"이다.
 */
export function solve(mines: Uint8Array, cols: number, rows: number, start: number): boolean {
  const size = cols * rows;
  const counts = countAll(mines, cols, rows);
  const revealed = new Uint8Array(size);
  const flagged = new Uint8Array(size);

  const reveal = (i: number) => {
    if (revealed[i] || flagged[i]) return;
    revealed[i] = 1;
    if (counts[i] === 0 && !mines[i]) {
      for (const j of neighbors(i, cols, rows)) reveal(j);
    }
  };

  reveal(start);

  for (;;) {
    let progress = false;

    /* 1, 2번 규칙 */
    for (let i = 0; i < size; i++) {
      if (!revealed[i] || mines[i]) continue;
      const nb = neighbors(i, cols, rows);
      const hidden = nb.filter((j) => !revealed[j] && !flagged[j]);
      if (hidden.length === 0) continue;
      const flags = nb.filter((j) => flagged[j]).length;

      if (counts[i] === flags) {
        hidden.forEach(reveal);
        progress = true;
      } else if (counts[i] - flags === hidden.length) {
        hidden.forEach((j) => { flagged[j] = 1; });
        progress = true;
      }
    }
    if (progress) continue;

    /* 3번 규칙: 이웃한 두 숫자의 부분집합 관계 */
    const constraints: { cells: number[]; need: number }[] = [];
    for (let i = 0; i < size; i++) {
      if (!revealed[i] || mines[i]) continue;
      const nb = neighbors(i, cols, rows);
      const hidden = nb.filter((j) => !revealed[j] && !flagged[j]);
      if (hidden.length === 0) continue;
      const flags = nb.filter((j) => flagged[j]).length;
      constraints.push({ cells: hidden, need: counts[i] - flags });
    }

    for (const a of constraints) {
      for (const b of constraints) {
        if (a === b || a.cells.length >= b.cells.length) continue;
        const setB = new Set(b.cells);
        if (!a.cells.every((x) => setB.has(x))) continue;
        const diff = b.cells.filter((x) => !a.cells.includes(x));
        if (diff.length === 0) continue;

        if (b.need - a.need === diff.length) {
          diff.forEach((j) => { flagged[j] = 1; });
          progress = true;
        } else if (b.need === a.need) {
          diff.forEach(reveal);
          progress = true;
        }
      }
      if (progress) break;
    }

    if (!progress) break;
  }

  let opened = 0;
  for (let i = 0; i < size; i++) if (revealed[i]) opened++;
  return opened === size - countMines(mines);
}

const countMines = (mines: Uint8Array) => mines.reduce((a, b) => a + b, 0);

/** 첫 클릭 주변 3×3은 항상 안전하게 비워 둔다 */
function safeZone(start: number, cols: number, rows: number): Set<number> {
  return new Set([start, ...neighbors(start, cols, rows)]);
}

function placeMines(
  cols: number, rows: number, mineCount: number, safe: Set<number>, rand: () => number
): Uint8Array {
  const size = cols * rows;
  const spots: number[] = [];
  for (let i = 0; i < size; i++) if (!safe.has(i)) spots.push(i);
  /* Fisher–Yates로 섞어 앞에서부터 뽑는다 */
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const mines = new Uint8Array(size);
  for (let k = 0; k < mineCount && k < spots.length; k++) mines[spots[k]] = 1;
  return mines;
}

/**
 * 첫 클릭 위치를 받아 보드를 만든다.
 * 추측이 필요 없는 배치를 찾을 때까지 다시 뽑고, 시도 한도를 넘기면
 * 마지막 배치를 그대로 쓰되 noGuess=false로 알린다.
 */
export function generate(
  spec: LevelSpec,
  start: number,
  rand: () => number = Math.random,
  maxAttempts = 400
): Layout {
  const { cols, rows, mines: mineCount } = spec;
  const safe = safeZone(start, cols, rows);
  let last = placeMines(cols, rows, mineCount, safe, rand);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const mines = placeMines(cols, rows, mineCount, safe, rand);
    last = mines;
    if (solve(mines, cols, rows, start)) {
      return { cols, rows, mines, counts: countAll(mines, cols, rows), noGuess: true };
    }
  }
  return { cols, rows, mines: last, counts: countAll(last, cols, rows), noGuess: false };
}

/** 0인 칸에서 시작하는 연쇄 열기 — 열린 칸 인덱스를 돌려준다 */
export function floodReveal(layout: Layout, revealed: Uint8Array, flagged: Uint8Array, start: number): number[] {
  const opened: number[] = [];
  const stack = [start];
  while (stack.length) {
    const i = stack.pop()!;
    if (revealed[i] || flagged[i]) continue;
    revealed[i] = 1;
    opened.push(i);
    if (layout.counts[i] === 0 && !layout.mines[i]) {
      for (const j of neighbors(i, layout.cols, layout.rows)) {
        if (!revealed[j] && !flagged[j]) stack.push(j);
      }
    }
  }
  return opened;
}

/** 숫자 칸을 눌렀을 때 주변 깃발 수가 숫자와 같으면 나머지를 한 번에 연다 */
export function chordTargets(layout: Layout, revealed: Uint8Array, flagged: Uint8Array, i: number): number[] {
  if (!revealed[i] || layout.counts[i] === 0) return [];
  const nb = neighbors(i, layout.cols, layout.rows);
  const flags = nb.filter((j) => flagged[j]).length;
  if (flags !== layout.counts[i]) return [];
  return nb.filter((j) => !revealed[j] && !flagged[j]);
}

export function isCleared(layout: Layout, revealed: Uint8Array): boolean {
  const size = layout.cols * layout.rows;
  let opened = 0;
  for (let i = 0; i < size; i++) if (revealed[i]) opened++;
  return opened === size - countMines(layout.mines);
}
