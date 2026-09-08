import { describe, it, expect } from 'vitest';
import {
  Card, GameState, applyMove, autoCompleteStep, autoTarget, canAutoComplete,
  canPlaceOnFoundation, canPlaceOnTableau, cardsOf, deal, draw, foundationIndex,
  hasAnyMove, isWon, legalMove,
} from '../src/games/solitaire/engine';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const card = (suit: Card['suit'], rank: number, faceUp = true): Card =>
  ({ id: `${suit}${rank}`, suit, rank, faceUp });

function emptyState(over: Partial<GameState> = {}): GameState {
  return {
    stock: [], waste: [], foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    drawCount: 1, moves: 0, passes: 0,
    ...over,
  };
}

describe('딜', () => {
  it('52장이 규칙대로 놓인다', () => {
    const s = deal(1, rng(7));
    const counts = s.tableau.map((t) => t.length);
    expect(counts).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(s.stock).toHaveLength(24);
    const all = [...s.stock, ...s.tableau.flat()];
    expect(all).toHaveLength(52);
    expect(new Set(all.map((c) => c.id)).size).toBe(52);
  });

  it('각 열의 맨 아래 카드만 앞면', () => {
    const s = deal(1, rng(9));
    for (const pile of s.tableau) {
      expect(pile[pile.length - 1].faceUp).toBe(true);
      expect(pile.slice(0, -1).every((c) => !c.faceUp)).toBe(true);
    }
  });
});

describe('놓을 수 있는지', () => {
  it('열에는 색이 엇갈리고 한 끗 작은 카드만', () => {
    expect(canPlaceOnTableau(card('H', 6), [card('S', 7)])).toBe(true);
    expect(canPlaceOnTableau(card('D', 6), [card('H', 7)])).toBe(false); // 같은 색
    expect(canPlaceOnTableau(card('H', 5), [card('S', 7)])).toBe(false); // 숫자 차이
  });

  it('빈 열에는 K만', () => {
    expect(canPlaceOnTableau(card('S', 13), [])).toBe(true);
    expect(canPlaceOnTableau(card('S', 12), [])).toBe(false);
  });

  it('기초 더미는 같은 무늬로 A부터', () => {
    expect(canPlaceOnFoundation(card('S', 1), [])).toBe(true);
    expect(canPlaceOnFoundation(card('S', 2), [card('S', 1)])).toBe(true);
    expect(canPlaceOnFoundation(card('H', 2), [card('S', 1)])).toBe(false);
    expect(canPlaceOnFoundation(card('S', 3), [card('S', 1)])).toBe(false);
  });
});

describe('카드 옮기기', () => {
  it('여러 장을 한 번에 옮긴다', () => {
    const s = emptyState();
    s.tableau[0] = [card('S', 8, false), card('H', 7), card('S', 6)];
    s.tableau[1] = [card('H', 9), card('S', 8)];
    const next = applyMove(s, { type: 'tableau', pile: 0, index: 1 }, { type: 'tableau', pile: 1 })!;
    expect(next).not.toBeNull();
    expect(next.tableau[1].map((c) => c.id)).toEqual(['H9', 'S8', 'H7', 'S6']);
    /* 남은 카드가 자동으로 뒤집힌다 */
    expect(next.tableau[0]).toHaveLength(1);
    expect(next.tableau[0][0].faceUp).toBe(true);
  });

  it('뒤집힌 카드가 섞이면 옮길 수 없다', () => {
    const s = emptyState();
    s.tableau[0] = [card('S', 8, false), card('H', 7)];
    expect(cardsOf(s, { type: 'tableau', pile: 0, index: 0 })).toEqual([]);
    expect(applyMove(s, { type: 'tableau', pile: 0, index: 0 }, { type: 'tableau', pile: 1 })).toBeNull();
  });

  it('기초 더미에는 한 장씩만', () => {
    const s = emptyState();
    s.tableau[0] = [card('S', 1), card('H', 2)];
    expect(legalMove(s, { type: 'tableau', pile: 0, index: 0 }, { type: 'foundation', pile: 0 })).toBe(false);
    s.tableau[1] = [card('S', 1)];
    expect(legalMove(s, { type: 'tableau', pile: 1, index: 0 }, { type: 'foundation', pile: foundationIndex('S') })).toBe(true);
  });

  it('같은 열로는 옮길 수 없다', () => {
    const s = emptyState();
    s.tableau[0] = [card('S', 13)];
    expect(legalMove(s, { type: 'tableau', pile: 0, index: 0 }, { type: 'tableau', pile: 0 })).toBe(false);
  });
});

describe('스톡', () => {
  it('한 장씩 뒤집어 버린 더미로', () => {
    const s = emptyState({ stock: [card('S', 5, false), card('H', 9, false)] });
    const next = draw(s);
    expect(next.waste).toHaveLength(1);
    expect(next.waste[0].faceUp).toBe(true);
    expect(next.stock).toHaveLength(1);
  });

  it('세 장 뽑기도 된다', () => {
    const stock = [1, 2, 3, 4].map((r) => card('S', r, false));
    const next = draw(emptyState({ stock, drawCount: 3 }));
    expect(next.waste).toHaveLength(3);
  });

  it('스톡이 비면 버린 더미를 되돌린다', () => {
    const s = emptyState({ stock: [], waste: [card('S', 5), card('H', 9)] });
    const next = draw(s);
    expect(next.stock).toHaveLength(2);
    expect(next.waste).toHaveLength(0);
    expect(next.stock.every((c) => !c.faceUp)).toBe(true);
    expect(next.passes).toBe(1);
  });

  it('스톡도 버린 더미도 비면 그대로', () => {
    const s = emptyState();
    expect(draw(s)).toBe(s);
  });
});

describe('두 번 눌러 보내기', () => {
  it('기초 더미를 먼저 고른다', () => {
    const s = emptyState();
    s.tableau[0] = [card('S', 1)];
    s.tableau[1] = [card('H', 2)];
    expect(autoTarget(s, { type: 'tableau', pile: 0, index: 0 })).toEqual({ type: 'foundation', pile: 0 });
  });

  it('기초 더미가 안 되면 놓을 수 있는 열', () => {
    const s = emptyState();
    s.tableau[0] = [card('H', 6)];
    s.tableau[1] = [card('S', 7)];
    expect(autoTarget(s, { type: 'tableau', pile: 0, index: 0 })).toEqual({ type: 'tableau', pile: 1 });
  });

  it('갈 곳이 없으면 null', () => {
    const s = emptyState();
    s.tableau[0] = [card('H', 6)];
    expect(autoTarget(s, { type: 'tableau', pile: 0, index: 0 })).toBeNull();
  });
});

describe('마무리', () => {
  it('전부 앞면이고 스톡이 비면 자동 완성이 가능하다', () => {
    const s = emptyState();
    s.tableau[0] = [card('S', 1)];
    expect(canAutoComplete(s)).toBe(true);
    s.stock = [card('H', 5, false)];
    expect(canAutoComplete(s)).toBe(false);
  });

  it('자동 완성은 한 장씩 올린다', () => {
    const s = emptyState();
    s.tableau[0] = [card('S', 1)];
    const next = autoCompleteStep(s)!;
    expect(next.foundations[0]).toHaveLength(1);
    expect(autoCompleteStep(next)).toBeNull();
  });

  it('네 무늬가 다 차면 승리', () => {
    const s = emptyState();
    s.foundations = [1, 2, 3, 4].map(() => Array.from({ length: 13 }, (_, i) => card('S', i + 1)));
    expect(isWon(s)).toBe(true);
  });

  it('둘 수 있는 수가 없으면 알려 준다', () => {
    const s = emptyState();
    s.tableau[0] = [card('H', 6)];
    s.tableau[1] = [card('D', 8)];
    expect(hasAnyMove(s)).toBe(false);
    s.tableau[2] = [card('S', 7)];
    expect(hasAnyMove(s)).toBe(true);
  });
});
