import { describe, it, expect, beforeEach } from 'vitest';
import { useYut } from '../src/games/yut/store';
import { GameState, Player, createGame, legalMoves } from '../src/games/yut/engine';

/**
 * 규칙 엔진이 아니라 화면 상태(store)를 본다.
 * 윷놀이에서 지금까지 나온 버그는 두 번 다 엔진이 아니라 여기 있었다.
 */

const put = (state: GameState, owner: Player, index: number, node: string) => {
  const piece = state.pieces.filter((p) => p.owner === owner)[index];
  piece.node = node;
  return piece;
};

/** 판 위에 청·홍 한 말씩 놓고, 아직 쓰지 않은 결과를 쥐여 준다 */
function boardWith(pending: GameState['pending']): GameState {
  const game = createGame('blue');
  put(game, 'blue', 0, 'o5');
  put(game, 'red', 0, 'o7');
  return { ...game, pending: [...pending] };
}

beforeEach(() => {
  useYut.setState({
    mode: 'vs-human',
    phase: 'moving',
    rolling: false,
    bonus: false,
    selected: null,
    message: null,
    log: [],
  });
});

describe('잡았을 때', () => {
  it('아직 쓰지 않은 결과를 남긴 채로 한 번 더 던진다', () => {
    /* 모가 나와 한 번 더 던져 개가 나온 상황 */
    const game = boardWith(['mo', 'gae']);
    useYut.setState({ game });

    /* 개로 두 칸 가서 o7의 홍 말을 잡는다 */
    const capture = legalMoves(game).find((m) => m.throw === 'gae' && m.to === 'o7');
    expect(capture, '개로 잡는 수가 있어야 한다').toBeTruthy();
    expect(capture!.captures).toBe(1);

    useYut.getState().playMove(capture!);
    const after = useYut.getState();

    expect(after.phase).toBe('throwing');
    expect(after.bonus).toBe(true);
    /* 쓴 것은 개뿐이다 — 모는 그대로 남아 있어야 한다 */
    expect(after.game.pending).toEqual(['mo']);
    expect(after.game.turn).toBe('blue');
  });

  it('남은 결과가 없으면 그냥 한 번 더 던진다', () => {
    const game = boardWith(['gae']);
    useYut.setState({ game });

    const capture = legalMoves(game).find((m) => m.to === 'o7')!;
    useYut.getState().playMove(capture);
    const after = useYut.getState();

    expect(after.phase).toBe('throwing');
    expect(after.game.pending).toEqual([]);
    expect(after.game.turn).toBe('blue');
  });
});

describe('잡지 않았을 때', () => {
  it('결과가 남아 있으면 이어서 둔다', () => {
    const game = boardWith(['mo', 'do']);
    useYut.setState({ game });

    /* 도로 한 칸 — 잡히는 말이 없는 자리 */
    const quiet = legalMoves(game).find((m) => m.throw === 'do' && m.to === 'o6')!;
    useYut.getState().playMove(quiet);
    const after = useYut.getState();

    expect(after.phase).toBe('moving');
    expect(after.game.pending).toEqual(['mo']);
    expect(after.game.turn).toBe('blue');
  });

  it('결과를 다 쓰면 차례가 넘어간다', () => {
    const game = boardWith(['do']);
    useYut.setState({ game });

    const quiet = legalMoves(game).find((m) => m.throw === 'do')!;
    useYut.getState().playMove(quiet);
    const after = useYut.getState();

    expect(after.phase).toBe('throwing');
    expect(after.game.pending).toEqual([]);
    expect(after.game.turn).toBe('red');
  });
});
