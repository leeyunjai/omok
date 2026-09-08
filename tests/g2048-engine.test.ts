import { describe, it, expect } from 'vitest';
import {
  Dir, SIZE, Tile, adoptIds, canMove, emptyCells, hasWon, maxTile, move, newGame, resetIds, spawn,
} from '../src/games/g2048/engine';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 격자 리터럴로 타일 만들기 (0은 빈칸) */
function build(rows: number[][]): Tile[] {
  resetIds();
  const tiles: Tile[] = [];
  let id = 1;
  rows.forEach((row, r) => row.forEach((v, c) => {
    if (v) tiles.push({ id: id++, value: v, r, c });
  }));
  return adoptIds(tiles);
}

/** 타일을 다시 격자로 */
function grid(tiles: Tile[]): number[][] {
  const g = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
  for (const t of tiles) g[t.r][t.c] = t.value;
  return g;
}

const shift = (rows: number[][], dir: Dir) => grid(move(build(rows), dir).tiles);

describe('밀기', () => {
  it('왼쪽으로 빈칸을 메운다', () => {
    expect(shift([[0, 0, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left'))
      .toEqual([[2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  });

  it('같은 값은 합쳐진다', () => {
    expect(shift([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')[0])
      .toEqual([4, 0, 0, 0]);
  });

  it('한 수에 두 번 합쳐지지 않는다', () => {
    /* 4 4 4 4 → 8 8 (8이 다시 16이 되면 안 된다) */
    expect(shift([[4, 4, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')[0])
      .toEqual([8, 8, 0, 0]);
  });

  it('합쳐지는 순서는 진행 방향 쪽이 먼저', () => {
    /* 오른쪽으로 밀면 오른쪽 두 개가 먼저 합쳐진다: 2 2 2 → 2 4 */
    expect(shift([[0, 2, 2, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'right')[0])
      .toEqual([0, 0, 2, 4]);
    expect(shift([[2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'left')[0])
      .toEqual([4, 2, 0, 0]);
  });

  it('위아래로도 같은 규칙', () => {
    expect(shift([[2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [0, 0, 0, 0]], 'up').map((r) => r[0]))
      .toEqual([4, 4, 0, 0]);
    expect(shift([[2, 0, 0, 0], [2, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], 'down').map((r) => r[0]))
      .toEqual([0, 0, 0, 4]);
  });

  it('점수는 합쳐서 만든 값의 합', () => {
    const res = move(build([[2, 2, 4, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left');
    expect(res.gained).toBe(4 + 8);
  });

  it('움직일 게 없으면 moved=false', () => {
    const res = move(build([[2, 4, 2, 4], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left');
    expect(res.moved).toBe(false);
    expect(res.gained).toBe(0);
  });

  it('합쳐진 타일은 하나만 남고 나머지는 사라진다', () => {
    const res = move(build([[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]), 'left');
    expect(res.tiles.filter((t) => t.value === 4)).toHaveLength(1);
    expect(res.removed).toHaveLength(1);
    /* 사라지는 타일도 합쳐진 자리로 옮겨 놓아야 미끄러지는 연출이 된다 */
    expect(res.removed[0]).toMatchObject({ r: 0, c: 0 });
  });
});

describe('타일 놓기', () => {
  it('빈 칸에만 놓는다', () => {
    const tiles = build([[2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 0]]);
    const t = spawn(tiles, rng(1))!;
    expect(t.r).toBe(3);
    expect(t.c).toBe(3);
    expect([2, 4]).toContain(t.value);
  });

  it('빈 칸이 없으면 null', () => {
    const full = build(Array.from({ length: 4 }, () => [2, 4, 2, 4]));
    expect(emptyCells(full)).toHaveLength(0);
    expect(spawn(full, rng(2))).toBeNull();
  });

  it('새 게임은 타일 두 개로 시작한다', () => {
    const tiles = newGame(rng(5));
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.value === 2 || t.value === 4)).toBe(true);
  });
});

describe('끝났는지', () => {
  it('빈 칸이 있으면 계속할 수 있다', () => {
    expect(canMove(build([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]]))).toBe(true);
  });

  it('꽉 찼어도 합칠 게 있으면 계속', () => {
    expect(canMove(build([[2, 2, 4, 8], [4, 8, 16, 32], [2, 4, 8, 16], [4, 8, 16, 32]]))).toBe(true);
  });

  it('꽉 차고 합칠 것도 없으면 끝', () => {
    expect(canMove(build([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]))).toBe(false);
  });

  it('2048이 나오면 달성', () => {
    expect(hasWon(build([[2048, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]))).toBe(true);
    expect(maxTile(build([[8, 0, 0, 0], [0, 16, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]))).toBe(16);
  });
});
