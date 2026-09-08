import { describe, it, expect } from 'vitest';
import {
  BALL_R, Ball, Brick, FIELD_H, FIELD_W, Item, PADDLE_Y, bounceOffPaddle, buildBricks,
  catchItems, isCleared, launchBall, levelSpec, rollItem, step,
} from '../src/games/breakout/engine';

const ball = (over: Partial<Ball> = {}): Ball =>
  ({ x: 160, y: 200, vx: 0, vy: 100, r: BALL_R, ...over });
const paddle = (x = 160, w = 60) => ({ x, w });
const run = (balls: Ball[], bricks: Brick[] = [], p = paddle(), items: Item[] = [], dt = 0.05) =>
  step({ balls, paddle: p, bricks, items, dt });

describe('벽 튕김', () => {
  it('옆벽에서 되튄다', () => {
    const b = [ball({ x: BALL_R + 1, vx: -200, vy: 0 })];
    const ev = run(b);
    expect(ev.wallHit).toBe(true);
    expect(b[0].vx).toBeGreaterThan(0);
    expect(b[0].x).toBeGreaterThanOrEqual(BALL_R);
  });

  it('천장에서 되튄다', () => {
    const b = [ball({ x: 160, y: BALL_R + 1, vx: 0, vy: -200 })];
    run(b);
    expect(b[0].vy).toBeGreaterThan(0);
  });

  it('바닥으로 빠지면 공을 잃는다', () => {
    const b = [ball({ y: FIELD_H - 1, vy: 400 })];
    const ev = run(b);
    expect(ev.lostBalls).toBe(1);
    expect(b).toHaveLength(0);
  });
});

describe('패들', () => {
  it('가운데에 맞으면 거의 수직으로 올라간다', () => {
    const b = bounceOffPaddle(ball({ x: 160, vy: 200 }), paddle(160));
    expect(b.vy).toBeLessThan(0);
    expect(Math.abs(b.vx)).toBeLessThan(Math.abs(b.vy));
  });

  it('끝에 맞으면 옆으로 크게 꺾인다', () => {
    const left = bounceOffPaddle(ball({ x: 135, vy: 200 }), paddle(160));
    const right = bounceOffPaddle(ball({ x: 185, vy: 200 }), paddle(160));
    expect(left.vx).toBeLessThan(0);
    expect(right.vx).toBeGreaterThan(0);
    expect(Math.abs(left.vx)).toBeGreaterThan(Math.abs(bounceOffPaddle(ball({ x: 162, vy: 200 }), paddle(160)).vx));
  });

  it('맞을 때마다 조금씩 빨라지되 상한이 있다', () => {
    let b = ball({ vx: 0, vy: 400 });
    for (let i = 0; i < 40; i++) b = bounceOffPaddle({ ...b, vy: Math.abs(b.vy) }, paddle(160));
    expect(Math.hypot(b.vx, b.vy)).toBeLessThanOrEqual(420 + 0.001);
  });

  it('패들 위를 지나면 위로 튕긴다', () => {
    const b = [ball({ x: 160, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 300 })];
    const ev = run(b, [], paddle(160));
    expect(ev.paddleHit).toBe(true);
    expect(b[0].vy).toBeLessThan(0);
  });
});

describe('벽돌', () => {
  const brick = (over: Partial<Brick> = {}): Brick =>
    ({ x: 140, y: 190, w: 40, h: 13, hp: 1, tone: 1, ...over });

  it('맞으면 hp가 줄고 튕긴다', () => {
    const bs = [brick()];
    const b = [ball({ x: 160, y: 210, vx: 0, vy: -200 })];
    const ev = run(b, bs);
    expect(ev.hitBricks).toHaveLength(1);
    expect(ev.broken).toBe(1);
    expect(b[0].vy).toBeGreaterThan(0);
    expect(bs).toHaveLength(0);
  });

  it('단단한 벽돌은 여러 번 맞아야 깨진다', () => {
    const bs = [brick({ hp: 2 })];
    const b = [ball({ x: 160, y: 210, vx: 0, vy: -200 })];
    const ev = run(b, bs);
    expect(ev.broken).toBe(0);
    expect(bs[0].hp).toBe(1);
  });

  it('빠른 공도 벽돌을 뚫고 지나가지 않는다', () => {
    const bs = [brick()];
    const b = [ball({ x: 160, y: 260, vx: 0, vy: -3000 })];
    run(b, bs, paddle(), [], 0.05);
    expect(bs).toHaveLength(0);
  });

  it('옆면에 맞으면 좌우로 튕긴다', () => {
    const bs = [brick({ x: 170, y: 195, w: 40, h: 13 })];
    const b = [ball({ x: 160, y: 201, vx: 200, vy: 0 })];
    run(b, bs);
    expect(b[0].vx).toBeLessThan(0);
  });
});

describe('아이템', () => {
  it('패들에 닿으면 받는다', () => {
    const items: Item[] = [{ x: 160, y: PADDLE_Y, kind: 'wide', vy: 60 }];
    expect(catchItems(paddle(160), items)).toEqual(['wide']);
    expect(items).toHaveLength(0);
  });

  it('빗나가면 그대로 떨어진다', () => {
    const items: Item[] = [{ x: 40, y: PADDLE_Y, kind: 'multi', vy: 60 }];
    expect(catchItems(paddle(260), items)).toEqual([]);
    expect(items).toHaveLength(1);
  });

  it('화면 아래로 나가면 사라진다', () => {
    const items: Item[] = [{ x: 100, y: FIELD_H + 20, kind: 'slow', vy: 60 }];
    run([ball()], [], paddle(), items);
    expect(items).toHaveLength(0);
  });

  it('확률은 정해진 범위 안', () => {
    expect(rollItem(() => 0.01)).toBe('multi');
    expect(rollItem(() => 0.1)).toBe('wide');
    expect(rollItem(() => 0.15)).toBe('slow');
    expect(rollItem(() => 0.9)).toBeNull();
  });
});

describe('판 구성', () => {
  it('레벨이 오를수록 줄이 늘고 단단해진다', () => {
    expect(levelSpec(1).rows).toBeLessThan(levelSpec(9).rows);
    expect(levelSpec(1).maxHp).toBeLessThanOrEqual(levelSpec(9).maxHp);
    expect(levelSpec(99).rows).toBeLessThanOrEqual(8);
  });

  it('벽돌은 화면 안에 놓인다', () => {
    for (let lv = 1; lv <= 6; lv++) {
      for (const b of buildBricks(lv, () => 0.5)) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(FIELD_W);
        expect(b.y).toBeGreaterThan(0);
        expect(b.hp).toBeGreaterThan(0);
      }
    }
  });

  it('다 깨면 판이 끝난다', () => {
    const bricks = buildBricks(1, () => 0.1);
    expect(isCleared(bricks)).toBe(false);
    bricks.forEach((b) => { b.hp = 0; });
    expect(isCleared(bricks)).toBe(true);
  });

  it('공은 패들 위에서 출발한다', () => {
    const b = launchBall(160);
    expect(b.y).toBeLessThan(PADDLE_Y);
    expect(b.vy).toBeLessThan(0);
    expect(b.x).toBe(160);
  });
});
