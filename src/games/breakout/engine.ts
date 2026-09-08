/**
 * 벽돌깨기 물리·규칙 엔진.
 * 화면과 무관한 논리 좌표(가로 320 × 세로 480)에서 계산하고,
 * 그리는 쪽에서 화면 크기에 맞춰 늘린다.
 */

export const FIELD_W = 320;
export const FIELD_H = 480;

export const PADDLE_Y = FIELD_H - 34;
export const PADDLE_H = 10;
export const BALL_R = 5;
export const BASE_SPEED = 210;   // 초당 논리 단위
export const MAX_SPEED = 420;
/** 패들 끝으로 갈수록 크게 꺾인다 (라디안) */
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

export interface Ball { x: number; y: number; vx: number; vy: number; r: number }
export interface Paddle { x: number; w: number }
export interface Brick { x: number; y: number; w: number; h: number; hp: number; tone: number; row: number }

export type ItemKind = 'wide' | 'multi' | 'slow';
export interface Item { x: number; y: number; kind: ItemKind; vy: number }

export interface StepEvents {
  /** 이번 걸음에 깨진 벽돌 수 */
  broken: number;
  /** 부딪힌 벽돌 (점수·아이템 판정용) */
  hitBricks: Brick[];
  paddleHit: boolean;
  wallHit: boolean;
  /** 바닥으로 빠진 공 */
  lostBalls: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function launchBall(paddleX: number, speed = BASE_SPEED, angle = -Math.PI / 3): Ball {
  return {
    x: paddleX,
    y: PADDLE_Y - BALL_R - 1,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: BALL_R,
  };
}

/** 원과 사각형이 겹치는지 + 어느 축으로 밀어내야 하는지 */
function hitRect(ball: Ball, r: { x: number; y: number; w: number; h: number }) {
  const nx = clamp(ball.x, r.x, r.x + r.w);
  const ny = clamp(ball.y, r.y, r.y + r.h);
  const dx = ball.x - nx;
  const dy = ball.y - ny;
  if (dx * dx + dy * dy > ball.r * ball.r) return null;

  /* 어느 면으로 들어왔는지 — 파고든 깊이가 작은 축으로 튕긴다 */
  const overlapX = ball.r + r.w / 2 - Math.abs(ball.x - (r.x + r.w / 2));
  const overlapY = ball.r + r.h / 2 - Math.abs(ball.y - (r.y + r.h / 2));
  return overlapX < overlapY ? 'x' : 'y';
}

/** 패들에 맞은 위치에 따라 튕기는 각도를 정한다 */
export function bounceOffPaddle(ball: Ball, paddle: Paddle): Ball {
  const offset = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
  const angle = offset * MAX_BOUNCE_ANGLE;
  const speed = Math.min(MAX_SPEED, Math.hypot(ball.vx, ball.vy) * 1.02);
  return {
    ...ball,
    y: PADDLE_Y - ball.r - 0.5,
    vx: Math.sin(angle) * speed,
    vy: -Math.abs(Math.cos(angle) * speed),
  };
}

export interface StepInput {
  balls: Ball[];
  paddle: Paddle;
  bricks: Brick[];
  items: Item[];
  dt: number;
}

/**
 * 한 걸음 진행. 공은 작은 조각으로 나눠 움직여 벽돌을 뚫고 지나가지 않게 한다.
 * 입력 배열을 직접 고치고, 일어난 일을 이벤트로 돌려준다.
 */
export function step(input: StepInput): StepEvents {
  const { paddle, bricks, dt } = input;
  const events: StepEvents = { broken: 0, hitBricks: [], paddleHit: false, wallHit: false, lostBalls: 0 };

  const alive: Ball[] = [];
  for (const ball of input.balls) {
    const speed = Math.hypot(ball.vx, ball.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / (BALL_R * 0.8)));
    const sub = dt / steps;
    let b = { ...ball };
    let lost = false;

    for (let i = 0; i < steps && !lost; i++) {
      b.x += b.vx * sub;
      b.y += b.vy * sub;

      /* 벽 */
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); events.wallHit = true; }
      if (b.x > FIELD_W - b.r) { b.x = FIELD_W - b.r; b.vx = -Math.abs(b.vx); events.wallHit = true; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); events.wallHit = true; }

      /* 패들 */
      if (
        b.vy > 0 &&
        b.y + b.r >= PADDLE_Y &&
        b.y - b.r <= PADDLE_Y + PADDLE_H &&
        Math.abs(b.x - paddle.x) <= paddle.w / 2 + b.r
      ) {
        b = bounceOffPaddle(b, paddle);
        events.paddleHit = true;
      }

      /* 벽돌 — 한 조각에 하나만 */
      for (let k = 0; k < bricks.length; k++) {
        const brick = bricks[k];
        if (brick.hp <= 0) continue;
        const axis = hitRect(b, brick);
        if (!axis) continue;
        if (axis === 'x') b.vx = -b.vx; else b.vy = -b.vy;
        brick.hp -= 1;
        events.hitBricks.push(brick);
        if (brick.hp <= 0) events.broken++;
        break;
      }

      /* 바닥 */
      if (b.y - b.r > FIELD_H) lost = true;
    }

    if (lost) events.lostBalls++;
    else alive.push(b);
  }

  input.balls.length = 0;
  input.balls.push(...alive);

  /* 떨어지는 아이템 */
  const keep: Item[] = [];
  for (const item of input.items) {
    item.y += item.vy * dt;
    if (item.y < FIELD_H + 12) keep.push(item);
  }
  input.items.length = 0;
  input.items.push(...keep);

  /* 남은 벽돌 정리 */
  for (let i = bricks.length - 1; i >= 0; i--) {
    if (bricks[i].hp <= 0) bricks.splice(i, 1);
  }

  return events;
}

/** 패들이 아이템을 받았는지 */
export function catchItems(paddle: Paddle, items: Item[]): ItemKind[] {
  const caught: ItemKind[] = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.y >= PADDLE_Y - 6 && it.y <= PADDLE_Y + PADDLE_H + 6 && Math.abs(it.x - paddle.x) <= paddle.w / 2 + 8) {
      caught.push(it.kind);
      items.splice(i, 1);
    }
  }
  return caught;
}

export interface LevelSpec {
  rows: number;
  cols: number;
  /** 위쪽 줄일수록 단단하게 */
  maxHp: number;
}

export function levelSpec(level: number): LevelSpec {
  return {
    rows: Math.min(4 + Math.floor((level - 1) / 2), 8),
    cols: 8,
    maxHp: Math.min(1 + Math.floor((level - 1) / 2), 3),
  };
}

/** 벽돌 배치 만들기 — 가운데가 비는 무늬를 섞어 판마다 달라 보이게 한다 */
export function buildBricks(level: number, rand: () => number = Math.random): Brick[] {
  const { rows, cols, maxHp } = levelSpec(level);
  const margin = 8;
  const gap = 3;
  const w = (FIELD_W - margin * 2 - gap * (cols - 1)) / cols;
  const h = 13;
  const top = 46;
  const pattern = Math.floor(rand() * 3);

  const bricks: Brick[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pattern === 1 && r % 2 === 1 && (c === 0 || c === cols - 1)) continue;
      if (pattern === 2 && r >= 2 && c >= 3 && c <= 4 && r < rows - 1) continue;
      const hp = Math.max(1, maxHp - Math.floor((r * maxHp) / rows));
      bricks.push({
        x: margin + c * (w + gap),
        y: top + r * (h + gap),
        w, h, hp,
        tone: hp,
        row: r,
      });
    }
  }
  return bricks;
}

export const isCleared = (bricks: Brick[]) => bricks.every((b) => b.hp <= 0);

/** 벽돌을 깼을 때 아이템이 떨어질지 */
export function rollItem(rand: () => number = Math.random): ItemKind | null {
  const v = rand();
  if (v < 0.06) return 'multi';
  if (v < 0.13) return 'wide';
  if (v < 0.18) return 'slow';
  return null;
}
