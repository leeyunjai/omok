/**
 * 클론다이크 솔리테어 규칙 엔진 — 화면과 무관한 순수 로직.
 * 카드는 52장뿐이라 상태를 통째로 복사해도 부담이 없어, 되돌리기를 위해 불변으로 다룬다.
 */

export type Suit = 'S' | 'H' | 'D' | 'C';
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const isRed = (s: Suit) => s === 'H' || s === 'D';

export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export interface Card {
  id: string;
  suit: Suit;
  rank: number;
  faceUp: boolean;
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  /** 스페이드·하트·다이아·클럽 순서 */
  foundations: Card[][];
  tableau: Card[][];
  drawCount: 1 | 3;
  moves: number;
  /** 스톡을 몇 번 돌렸는지 */
  passes: number;
}

export type Source =
  | { type: 'waste' }
  | { type: 'tableau'; pile: number; index: number }
  | { type: 'foundation'; pile: number };

export type Target =
  | { type: 'tableau'; pile: number }
  | { type: 'foundation'; pile: number };

function shuffled(rand: () => number): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ id: `${suit}${rank}`, suit, rank, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function deal(drawCount: 1 | 3 = 1, rand: () => number = Math.random): GameState {
  const deck = shuffled(rand);
  const tableau: Card[][] = [];
  for (let pile = 0; pile < 7; pile++) {
    const cards = deck.splice(0, pile + 1).map((c) => ({ ...c }));
    cards[cards.length - 1].faceUp = true;
    tableau.push(cards);
  }
  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount,
    moves: 0,
    passes: 0,
  };
}

const clone = (s: GameState): GameState => ({
  stock: s.stock.map((c) => ({ ...c })),
  waste: s.waste.map((c) => ({ ...c })),
  foundations: s.foundations.map((f) => f.map((c) => ({ ...c }))),
  tableau: s.tableau.map((t) => t.map((c) => ({ ...c }))),
  drawCount: s.drawCount,
  moves: s.moves,
  passes: s.passes,
});

export const foundationIndex = (suit: Suit) => SUITS.indexOf(suit);

/** 열에 내려놓을 수 있는가 — 색이 엇갈리고 숫자가 하나 작아야 한다 */
export function canPlaceOnTableau(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) return card.rank === 13;
  const top = pile[pile.length - 1];
  if (!top.faceUp) return false;
  return isRed(top.suit) !== isRed(card.suit) && top.rank === card.rank + 1;
}

/** 같은 무늬로 A부터 차례대로 */
export function canPlaceOnFoundation(card: Card, foundation: Card[]): boolean {
  if (foundation.length === 0) return card.rank === 1;
  const top = foundation[foundation.length - 1];
  return top.suit === card.suit && top.rank + 1 === card.rank;
}

/** 옮기려는 카드 뭉치 (뒤집힌 카드가 섞였으면 빈 배열) */
export function cardsOf(state: GameState, src: Source): Card[] {
  if (src.type === 'waste') {
    const c = state.waste[state.waste.length - 1];
    return c ? [c] : [];
  }
  if (src.type === 'foundation') {
    const c = state.foundations[src.pile][state.foundations[src.pile].length - 1];
    return c ? [c] : [];
  }
  const pile = state.tableau[src.pile];
  const run = pile.slice(src.index);
  if (run.length === 0 || run.some((c) => !c.faceUp)) return [];
  return run;
}

export function legalMove(state: GameState, src: Source, dst: Target): boolean {
  const cards = cardsOf(state, src);
  if (cards.length === 0) return false;
  if (src.type === 'tableau' && dst.type === 'tableau' && src.pile === dst.pile) return false;

  if (dst.type === 'foundation') {
    if (cards.length !== 1) return false;
    if (foundationIndex(cards[0].suit) !== dst.pile) return false;
    return canPlaceOnFoundation(cards[0], state.foundations[dst.pile]);
  }
  return canPlaceOnTableau(cards[0], state.tableau[dst.pile]);
}

export function applyMove(state: GameState, src: Source, dst: Target): GameState | null {
  if (!legalMove(state, src, dst)) return null;
  const next = clone(state);
  const cards = cardsOf(next, src);

  /* 원래 자리에서 빼기 */
  if (src.type === 'waste') next.waste.pop();
  else if (src.type === 'foundation') next.foundations[src.pile].pop();
  else next.tableau[src.pile].splice(src.index);

  /* 새 자리에 놓기 */
  if (dst.type === 'foundation') next.foundations[dst.pile].push(cards[0]);
  else next.tableau[dst.pile].push(...cards);

  /* 열 맨 위 카드는 자동으로 뒤집는다 */
  if (src.type === 'tableau') {
    const pile = next.tableau[src.pile];
    const top = pile[pile.length - 1];
    if (top && !top.faceUp) top.faceUp = true;
  }

  next.moves = state.moves + 1;
  return next;
}

/** 스톡에서 뽑기. 스톡이 비면 버린 더미를 되돌린다. */
export function draw(state: GameState): GameState {
  const next = clone(state);
  if (next.stock.length === 0) {
    if (next.waste.length === 0) return state;
    next.stock = next.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    next.waste = [];
    next.passes = state.passes + 1;
    next.moves = state.moves + 1;
    return next;
  }
  const count = Math.min(next.drawCount, next.stock.length);
  for (let i = 0; i < count; i++) {
    const card = next.stock.pop()!;
    card.faceUp = true;
    next.waste.push(card);
  }
  next.moves = state.moves + 1;
  return next;
}

/** 두 번 누르면 갈 자리 — 기초 더미를 먼저 보고, 없으면 놓을 수 있는 열 */
export function autoTarget(state: GameState, src: Source): Target | null {
  const cards = cardsOf(state, src);
  if (cards.length === 0) return null;

  if (cards.length === 1) {
    const fi = foundationIndex(cards[0].suit);
    if (canPlaceOnFoundation(cards[0], state.foundations[fi])) return { type: 'foundation', pile: fi };
  }
  /* 카드가 이미 있는 열을 먼저 고른다 — 빈 열로 옮겨 봐야 이득이 없는 경우가 많다 */
  const piles = [...state.tableau.keys()].sort(
    (a, b) => (state.tableau[b].length > 0 ? 1 : 0) - (state.tableau[a].length > 0 ? 1 : 0)
  );
  for (const pile of piles) {
    if (src.type === 'tableau' && src.pile === pile) continue;
    if (canPlaceOnTableau(cards[0], state.tableau[pile])) return { type: 'tableau', pile };
  }
  return null;
}

export function isWon(state: GameState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

/** 모든 카드가 앞면이면 남은 건 기초 더미로 올리는 일뿐이다 */
export function canAutoComplete(state: GameState): boolean {
  if (isWon(state)) return false;
  if (state.stock.length > 0 || state.waste.length > 0) return false;
  return state.tableau.every((pile) => pile.every((c) => c.faceUp));
}

/** 자동 완성 한 걸음 — 올릴 카드가 없으면 null */
export function autoCompleteStep(state: GameState): GameState | null {
  for (let pile = 0; pile < state.tableau.length; pile++) {
    const cards = state.tableau[pile];
    if (cards.length === 0) continue;
    const src: Source = { type: 'tableau', pile, index: cards.length - 1 };
    const card = cards[cards.length - 1];
    const fi = foundationIndex(card.suit);
    if (canPlaceOnFoundation(card, state.foundations[fi])) {
      return applyMove(state, src, { type: 'foundation', pile: fi });
    }
  }
  return null;
}

/** 지금 둘 수 있는 수가 하나라도 있는지 (막힘 안내용) */
export function hasAnyMove(state: GameState): boolean {
  if (state.stock.length > 0 || state.waste.length > 0) return true;
  for (let pile = 0; pile < state.tableau.length; pile++) {
    const cards = state.tableau[pile];
    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].faceUp) continue;
      const src: Source = { type: 'tableau', pile, index: i };
      if (autoTarget(state, src)) return true;
    }
  }
  return false;
}
