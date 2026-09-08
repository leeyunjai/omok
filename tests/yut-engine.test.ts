import { describe, it, expect } from 'vitest';
import {
  GOAL, PIECES_PER_SIDE, Player, START, applyMove, createGame, distanceToGoal,
  isBonusThrow, legalMoves, nextNode, other, piecesAt, route, targetOf, throwYut,
} from '../src/games/yut/engine';

const put = (state: ReturnType<typeof createGame>, owner: Player, index: number, node: string) => {
  const piece = state.pieces.filter((p) => p.owner === owner)[index];
  piece.node = node;
  return piece;
};

describe('판 경로', () => {
  it('바깥 길은 순서대로 이어진다', () => {
    expect(nextNode('o0', null)).toBe('o1');
    expect(nextNode('o18', null)).toBe('o19');
    expect(nextNode('o19', null)).toBe(GOAL);
  });

  it('모서리에 멈추면 지름길로 들어간다', () => {
    expect(nextNode('o4', null, true)).toBe('a1');
    expect(nextNode('o9', null, true)).toBe('c1');
    /* 지나가기만 할 때는 바깥 길 */
    expect(nextNode('o4', 'o3', false)).toBe('o5');
  });

  it('모서리를 지나갈 때는 지름길을 타지 않는다', () => {
    /* o2에서 걸(3)이면 o3 → o4 → o5 로 지나간다 */
    expect(route('o2', 3)).toEqual(['o3', 'o4', 'o5']);
  });

  it('첫 지름길로 들어가면 중앙을 지나 반대편으로 나간다', () => {
    expect(route('o4', 6)).toEqual(['a1', 'a2', 'center', 'b1', 'b2', 'o14']);
  });

  it('두 번째 지름길은 중앙을 지나 바로 도착으로 간다', () => {
    expect(route('o9', 6)).toEqual(['c1', 'c2', 'center', 'd1', 'd2', GOAL]);
  });

  it('중앙에 멈춘 말은 참먹이 쪽으로 빠진다', () => {
    expect(route('center', 3)).toEqual(['d1', 'd2', GOAL]);
  });

  it('도착까지 남은 칸을 잰다', () => {
    expect(distanceToGoal(GOAL)).toBe(0);
    expect(distanceToGoal('d2')).toBe(1);
    expect(distanceToGoal('o19')).toBe(1);
    expect(distanceToGoal('o9')).toBeLessThan(distanceToGoal('o0'));
  });
});

describe('윷 던지기', () => {
  it('네 가락이 모두 엎어지면 모', () => {
    expect(throwYut(() => 0.9).result).toBe('mo');
  });
  it('네 가락이 모두 뒤집히면 윷', () => {
    expect(throwYut(() => 0.1).result).toBe('yut');
  });
  it('윷과 모는 한 번 더 던진다', () => {
    expect(isBonusThrow('yut')).toBe(true);
    expect(isBonusThrow('mo')).toBe(true);
    expect(isBonusThrow('geol')).toBe(false);
  });
  it('표시된 가락 하나만 뒤집히면 뒤도', () => {
    let calls = 0;
    /* 첫 가락만 배가 위 */
    const rand = () => (calls++ === 0 ? 0.1 : 0.9);
    expect(throwYut(rand).result).toBe('backdo');
  });
});

describe('말 옮기기', () => {
  it('출발점 말은 도로 첫 칸에 들어간다', () => {
    const s = createGame();
    const p = s.pieces[0];
    expect(targetOf(p, 'do')).toBe('o0');
  });

  it('출발점 말은 뒤도로 움직이지 못한다', () => {
    const s = createGame();
    expect(targetOf(s.pieces[0], 'backdo')).toBeNull();
  });

  it('뒤도는 한 칸 뒤로 간다', () => {
    const s = createGame();
    const p = put(s, 'blue', 0, 'o5');
    expect(targetOf(p, 'backdo')).toBe('o4');
  });

  it('칸을 넘겨도 도착으로 인정한다', () => {
    const s = createGame();
    const p = put(s, 'blue', 0, 'o19');
    expect(targetOf(p, 'mo')).toBe(GOAL);
  });
});

describe('잡기와 업기', () => {
  it('상대 말이 있는 칸에 가면 잡는다', () => {
    const s = createGame();
    put(s, 'blue', 0, 'o2');
    put(s, 'red', 0, 'o4');
    s.pending = ['gae'];
    const move = legalMoves(s).find((m) => m.to === 'o4')!;
    expect(move.captures).toBe(1);
    const res = applyMove(s, move);
    expect(res.captured).toBe(1);
    expect(res.extraTurn).toBe(true);
    expect(piecesAt(res.state, START, 'red')).toHaveLength(PIECES_PER_SIDE);
  });

  it('내 말이 있는 칸에 가면 업힌다', () => {
    const s = createGame();
    put(s, 'blue', 0, 'o2');
    put(s, 'blue', 1, 'o4');
    s.pending = ['gae'];
    const move = legalMoves(s).find((m) => m.to === 'o4' && m.pieceId === s.pieces[0].id)!;
    expect(move.stacksWith).toBe(1);
    const res = applyMove(s, move);
    const stacked = piecesAt(res.state, 'o4', 'blue');
    expect(stacked).toHaveLength(2);
    expect(stacked[0].stack).toBe(2);
  });

  it('업힌 말은 함께 움직인다', () => {
    const s = createGame();
    put(s, 'blue', 0, 'o3');
    put(s, 'blue', 1, 'o3');
    s.pending = ['do'];
    const move = legalMoves(s)[0];
    const res = applyMove(s, move);
    expect(piecesAt(res.state, 'o4', 'blue')).toHaveLength(2);
    expect(piecesAt(res.state, 'o3', 'blue')).toHaveLength(0);
  });

  it('업힌 무리를 잡으면 전부 돌아간다', () => {
    const s = createGame();
    put(s, 'red', 0, 'o6');
    put(s, 'red', 1, 'o6');
    /* 무리 크기를 다시 세기 위해 한 번 적용해 둔다 */
    s.pieces.filter((p) => p.node === 'o6').forEach((p) => { p.stack = 2; });
    put(s, 'blue', 0, 'o3');
    s.pending = ['geol'];
    const move = legalMoves(s).find((m) => m.to === 'o6')!;
    const res = applyMove(s, move);
    expect(res.captured).toBe(4); // 2말 × stack 2
    expect(piecesAt(res.state, 'o6', 'red')).toHaveLength(0);
  });
});

describe('승부', () => {
  it('네 말이 모두 나가면 이긴다', () => {
    const s = createGame();
    const blues = s.pieces.filter((p) => p.owner === 'blue');
    blues.slice(0, 3).forEach((p) => { p.done = true; p.node = GOAL; });
    blues[3].node = 'o19';
    s.pending = ['do'];
    const move = legalMoves(s).find((m) => m.finishes)!;
    const res = applyMove(s, move);
    expect(res.state.winner).toBe('blue');
  });

  it('상대 차례는 반대편', () => {
    expect(other('blue')).toBe('red');
    expect(other('red')).toBe('blue');
  });

  it('쓸 수 있는 결과가 없으면 둘 수 있는 수도 없다', () => {
    const s = createGame();
    s.pending = ['backdo'];
    expect(legalMoves(s)).toHaveLength(0);
  });
});

describe('출발점', () => {
  it('대기 중인 말은 한 번에 하나씩 들어간다', () => {
    const s = createGame();
    s.pending = ['do'];
    const moves = legalMoves(s);
    /* 같은 결과·같은 칸이면 수는 하나로 묶인다 */
    expect(moves).toHaveLength(1);
    const res = applyMove(s, moves[0]);
    expect(piecesAt(res.state, 'o0', 'blue')).toHaveLength(1);
    expect(piecesAt(res.state, START, 'blue')).toHaveLength(PIECES_PER_SIDE - 1);
  });

  it('출발점 말끼리는 업히지 않는다', () => {
    const s = createGame();
    s.pending = ['do', 'gae'];
    const first = applyMove(s, legalMoves(s).find((m) => m.throw === 'do')!);
    /* 이번에는 출발점에 남아 있는 말을 개(2)로 들여보낸다 */
    const fromStart = legalMoves(first.state).find((m) => {
      const piece = first.state.pieces.find((p) => p.id === m.pieceId);
      return m.throw === 'gae' && piece?.node === START;
    })!;
    const second = applyMove(first.state, fromStart);
    /* 두 말이 각각 다른 칸에 있다 */
    expect(piecesAt(second.state, 'o0', 'blue')).toHaveLength(1);
    expect(piecesAt(second.state, 'o1', 'blue')).toHaveLength(1);
  });

  it('판 위에서 만나면 그때 업힌다', () => {
    const s = createGame();
    s.pending = ['do'];
    const first = applyMove(s, legalMoves(s)[0]);
    first.state.pending = ['do'];
    const second = applyMove(first.state, legalMoves(first.state).find((m) => m.to === 'o0')!);
    expect(piecesAt(second.state, 'o0', 'blue')).toHaveLength(2);
    expect(piecesAt(second.state, 'o0', 'blue')[0].stack).toBe(2);
  });
});
