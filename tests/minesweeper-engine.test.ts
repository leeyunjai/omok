import { describe, it, expect } from 'vitest';
import {
  LEVELS, chordTargets, floodReveal, generate, isCleared, neighbors, solve,
} from '../src/games/minesweeper/engine';

/** 재현 가능한 난수 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const countMines = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

describe('보드 기본', () => {
  it('이웃은 최대 8칸, 모서리는 3칸', () => {
    expect(neighbors(0, 9, 9)).toHaveLength(3);
    expect(neighbors(10, 9, 9)).toHaveLength(8);
    expect(neighbors(80, 9, 9)).toHaveLength(3);
  });

  it('지뢰 수가 정확하고 첫 클릭 주변은 안전하다', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const spec = LEVELS[level];
      const start = Math.floor((spec.cols * spec.rows) / 2);
      const layout = generate(spec, start, rng(level.length * 7 + 1));
      expect(countMines(layout.mines)).toBe(spec.mines);
      expect(layout.mines[start]).toBe(0);
      for (const j of neighbors(start, spec.cols, spec.rows)) {
        expect(layout.mines[j]).toBe(0);
      }
    }
  });

  it('주변 지뢰 수가 실제 배치와 맞는다', () => {
    const spec = LEVELS.easy;
    const layout = generate(spec, 40, rng(11));
    for (let i = 0; i < layout.counts.length; i++) {
      if (layout.mines[i]) continue;
      const actual = neighbors(i, layout.cols, layout.rows).filter((j) => layout.mines[j]).length;
      expect(layout.counts[i]).toBe(actual);
    }
  });
});

describe('추측 없이 풀리는 보드', () => {
  it('생성된 판은 솔버로 끝까지 열린다', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const spec = LEVELS.easy;
      const start = 40;
      const layout = generate(spec, start, rng(seed));
      expect(layout.noGuess).toBe(true);
      expect(solve(layout.mines, spec.cols, spec.rows, start)).toBe(true);
    }
  });

  it('보통·어려움도 추측 없이 풀리는 판을 찾는다', () => {
    for (const level of ['normal', 'hard'] as const) {
      const spec = LEVELS[level];
      const start = Math.floor((spec.cols * spec.rows) / 2);
      const layout = generate(spec, start, rng(level === 'normal' ? 21 : 31));
      expect(layout.noGuess).toBe(true);
    }
  });

  it('추측이 필요한 배치는 솔버가 거른다', () => {
    /* 1×3 판에 지뢰 하나 — 양 끝 중 어디인지 알 수 없는 배치 */
    const cols = 3, rows = 1;
    const mines = new Uint8Array([1, 0, 0]);
    /* 가운데에서 시작하면 1이 뜨고 좌우 중 어느 쪽인지 확정할 수 없다 */
    expect(solve(mines, cols, rows, 1)).toBe(false);
  });
});

describe('열기와 코드 클릭', () => {
  it('0인 칸은 연쇄로 열린다', () => {
    const spec = LEVELS.easy;
    const layout = generate(spec, 40, rng(5));
    const revealed = new Uint8Array(spec.cols * spec.rows);
    const flagged = new Uint8Array(spec.cols * spec.rows);
    const opened = floodReveal(layout, revealed, flagged, 40);
    expect(opened.length).toBeGreaterThan(1);
    expect(opened.every((i) => layout.mines[i] === 0)).toBe(true);
  });

  it('깃발 수가 숫자와 같을 때만 코드가 동작한다', () => {
    const spec = LEVELS.easy;
    const layout = generate(spec, 40, rng(9));
    const size = spec.cols * spec.rows;
    const revealed = new Uint8Array(size);
    const flagged = new Uint8Array(size);
    floodReveal(layout, revealed, flagged, 40);

    const numbered = [...Array(size).keys()].find(
      (i) => revealed[i] && layout.counts[i] > 0
    )!;
    expect(chordTargets(layout, revealed, flagged, numbered)).toEqual([]);

    /* 실제 지뢰에 깃발을 꽂으면 나머지를 열어 준다 */
    for (const j of neighbors(numbered, spec.cols, spec.rows)) {
      if (layout.mines[j]) flagged[j] = 1;
    }
    const targets = chordTargets(layout, revealed, flagged, numbered);
    expect(targets.every((j) => layout.mines[j] === 0)).toBe(true);
  });

  it('지뢰 아닌 칸을 모두 열면 승리', () => {
    const spec = LEVELS.easy;
    const layout = generate(spec, 40, rng(3));
    const size = spec.cols * spec.rows;
    const revealed = new Uint8Array(size);
    for (let i = 0; i < size; i++) if (!layout.mines[i]) revealed[i] = 1;
    expect(isCleared(layout, revealed)).toBe(true);
    revealed[[...Array(size).keys()].find((i) => !layout.mines[i])!] = 0;
    expect(isCleared(layout, revealed)).toBe(false);
  });
});
