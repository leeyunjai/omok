/**
 * 2048 규칙 엔진.
 * 타일마다 id를 두어 "어디서 어디로 움직였는지"를 화면이 알 수 있게 한다.
 * 그래야 미끄러지는 연출이 가능하다.
 */

export const SIZE = 4;
export const WIN_VALUE = 2048;

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  value: number;
  r: number;
  c: number;
  /** 이번 수에 합쳐져 값이 커진 타일 */
  merged?: boolean;
  /** 이번 수에 새로 생긴 타일 */
  isNew?: boolean;
}

export interface MoveResult {
  tiles: Tile[];
  /** 합쳐지며 사라질 타일 — 화면에서 잠깐 더 보여 준 뒤 지운다 */
  removed: Tile[];
  gained: number;
  moved: boolean;
}

let nextId = 1;
export const resetIds = () => { nextId = 1; };
const makeTile = (value: number, r: number, c: number, isNew = false): Tile =>
  ({ id: nextId++, value, r, c, isNew });

export function emptyCells(tiles: Tile[]): [number, number][] {
  const taken = new Set(tiles.map((t) => t.r * SIZE + t.c));
  const out: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (!taken.has(r * SIZE + c)) out.push([r, c]);
  }
  return out;
}

/** 빈 칸에 새 타일 하나 — 열에 하나는 2, 열에 하나는 4 */
export function spawn(tiles: Tile[], rand: () => number = Math.random): Tile | null {
  const cells = emptyCells(tiles);
  if (cells.length === 0) return null;
  const [r, c] = cells[Math.floor(rand() * cells.length)];
  return makeTile(rand() < 0.9 ? 2 : 4, r, c, true);
}

export function newGame(rand: () => number = Math.random): Tile[] {
  resetIds();
  const tiles: Tile[] = [];
  for (let i = 0; i < 2; i++) {
    const t = spawn(tiles, rand);
    if (t) tiles.push(t);
  }
  return tiles;
}

/** 방향에 따른 줄 훑는 순서 — 진행 방향 쪽부터 본다 */
function lines(dir: Dir): [number, number][][] {
  const out: [number, number][][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: [number, number][] = [];
    for (let j = 0; j < SIZE; j++) {
      if (dir === 'left') line.push([i, j]);
      else if (dir === 'right') line.push([i, SIZE - 1 - j]);
      else if (dir === 'up') line.push([j, i]);
      else line.push([SIZE - 1 - j, i]);
    }
    out.push(line);
  }
  return out;
}

export function move(tiles: Tile[], dir: Dir): MoveResult {
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
  for (const t of tiles) grid[t.r][t.c] = { ...t, merged: false, isNew: false };

  const next: Tile[] = [];
  const removed: Tile[] = [];
  let gained = 0;
  let moved = false;

  for (const line of lines(dir)) {
    /* 이 줄에 있는 타일만 순서대로 모은다 */
    const queue: Tile[] = [];
    for (const [r, c] of line) {
      const t = grid[r][c];
      if (t) queue.push(t);
    }

    let slot = 0;
    let i = 0;
    while (i < queue.length) {
      const cur = queue[i];
      const [tr, tc] = line[slot];
      const partner = queue[i + 1];

      if (partner && partner.value === cur.value) {
        /* 한 수에 같은 타일이 두 번 합쳐지지는 않는다 */
        const value = cur.value * 2;
        gained += value;
        next.push({ id: cur.id, value, r: tr, c: tc, merged: true });
        removed.push({ ...partner, r: tr, c: tc });
        if (cur.r !== tr || cur.c !== tc || partner.r !== tr || partner.c !== tc) moved = true;
        i += 2;
      } else {
        if (cur.r !== tr || cur.c !== tc) moved = true;
        next.push({ ...cur, r: tr, c: tc });
        i += 1;
      }
      slot++;
    }
  }

  return { tiles: next, removed, gained, moved };
}

export function canMove(tiles: Tile[]): boolean {
  if (emptyCells(tiles).length > 0) return true;
  const grid: (Tile | null)[][] = Array.from({ length: SIZE }, () => new Array(SIZE).fill(null));
  for (const t of tiles) grid[t.r][t.c] = t;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c]?.value;
      if (v === undefined) continue;
      if (c + 1 < SIZE && grid[r][c + 1]?.value === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c]?.value === v) return true;
    }
  }
  return false;
}

export const maxTile = (tiles: Tile[]) => tiles.reduce((m, t) => Math.max(m, t.value), 0);
export const hasWon = (tiles: Tile[]) => maxTile(tiles) >= WIN_VALUE;

/** 저장본에서 되살릴 때 id를 이어 붙인다 */
export function adoptIds(tiles: Tile[]): Tile[] {
  nextId = Math.max(nextId, ...tiles.map((t) => t.id + 1), 1);
  return tiles;
}
