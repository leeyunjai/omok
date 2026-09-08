import {
  BASE_SPEED, Ball, Brick, FIELD_H, FIELD_W, Item, ItemKind, PADDLE_Y,
  buildBricks, catchItems, isCleared, launchBall, rollItem, step,
} from './engine';
import { sfx } from '../../shared/sound';

export type Status = 'ready' | 'playing' | 'paused' | 'clear' | 'over';

export interface Hud {
  status: Status;
  score: number;
  level: number;
  lives: number;
  /** 지금 걸려 있는 효과와 남은 시간(초) */
  effects: { kind: ItemKind; left: number }[];
  bricksLeft: number;
}

const PADDLE_BASE_W = 62;
const PADDLE_WIDE_W = 96;
const EFFECT_MS = 9000;
const START_LIVES = 3;

export class BreakoutGame {
  balls: Ball[] = [];
  bricks: Brick[] = [];
  items: Item[] = [];
  paddle = { x: FIELD_W / 2, w: PADDLE_BASE_W };
  status: Status = 'ready';
  score = 0;
  level = 1;
  lives = START_LIVES;

  private effects = new Map<ItemKind, number>();
  private slowUntil = 0;

  onHud: (hud: Hud) => void = () => {};

  hud(): Hud {
    return {
      status: this.status,
      score: this.score,
      level: this.level,
      lives: this.lives,
      effects: [...this.effects.entries()].map(([kind, until]) => ({
        kind,
        left: Math.max(0, Math.ceil((until - performance.now()) / 1000)),
      })),
      bricksLeft: this.bricks.length,
    };
  }

  private emit() { this.onHud(this.hud()); }

  start() {
    this.score = 0;
    this.level = 1;
    this.lives = START_LIVES;
    this.effects.clear();
    this.paddle = { x: FIELD_W / 2, w: PADDLE_BASE_W };
    this.loadLevel();
    this.status = 'playing';
    this.emit();
  }

  private loadLevel() {
    this.bricks = buildBricks(this.level);
    this.items = [];
    this.balls = [launchBall(this.paddle.x, BASE_SPEED + (this.level - 1) * 12)];
  }

  nextLevel() {
    this.level += 1;
    this.effects.clear();
    this.paddle.w = PADDLE_BASE_W;
    this.loadLevel();
    this.status = 'playing';
    this.emit();
  }

  pause() { if (this.status === 'playing') { this.status = 'paused'; this.emit(); } }
  resume() { if (this.status === 'paused') { this.status = 'playing'; this.emit(); } }
  togglePause() { this.status === 'paused' ? this.resume() : this.pause(); }

  /** 화면에서 손가락이 움직인 만큼 패들을 옮긴다 (논리 좌표) */
  movePaddle(x: number) {
    this.paddle.x = Math.min(FIELD_W - this.paddle.w / 2, Math.max(this.paddle.w / 2, x));
    /* 아직 시작 전이면 공도 함께 따라간다 */
    if (this.status !== 'playing') return;
    for (const b of this.balls) {
      if (b.vy === 0 && b.vx === 0) b.x = this.paddle.x;
    }
  }

  nudge(dir: -1 | 1) {
    this.movePaddle(this.paddle.x + dir * 18);
  }

  private applyItem(kind: ItemKind) {
    const now = performance.now();
    this.effects.set(kind, now + EFFECT_MS);
    if (kind === 'wide') this.paddle.w = PADDLE_WIDE_W;
    if (kind === 'slow') this.slowUntil = now + EFFECT_MS;
    if (kind === 'multi') {
      /* 지금 있는 공을 좌우로 하나씩 늘린다 */
      const extra: Ball[] = [];
      for (const b of this.balls.slice(0, 2)) {
        const speed = Math.hypot(b.vx, b.vy);
        for (const angle of [-0.4, 0.4]) {
          const dir = Math.atan2(b.vy, b.vx) + angle;
          extra.push({ ...b, vx: Math.cos(dir) * speed, vy: Math.sin(dir) * speed });
        }
      }
      this.balls.push(...extra);
    }
    sfx.levelUp();
  }

  private expireEffects() {
    const now = performance.now();
    for (const [kind, until] of this.effects) {
      if (until > now) continue;
      this.effects.delete(kind);
      if (kind === 'wide') this.paddle.w = PADDLE_BASE_W;
    }
  }

  update(dtMs: number) {
    if (this.status !== 'playing') return;
    const slow = performance.now() < this.slowUntil ? 0.62 : 1;
    const dt = Math.min(dtMs, 40) / 1000 * slow;

    const ev = step({ balls: this.balls, paddle: this.paddle, bricks: this.bricks, items: this.items, dt });

    if (ev.paddleHit) sfx.move();
    if (ev.wallHit) sfx.tap();

    for (const brick of ev.hitBricks) {
      this.score += brick.hp <= 0 ? 20 : 5;
      if (brick.hp <= 0) {
        const kind = rollItem();
        if (kind) this.items.push({ x: brick.x + brick.w / 2, y: brick.y, kind, vy: 90 });
      }
    }
    if (ev.broken > 0) sfx.place();

    for (const kind of catchItems(this.paddle, this.items)) this.applyItem(kind);
    this.expireEffects();

    if (ev.lostBalls > 0 && this.balls.length === 0) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.status = 'over';
        sfx.lose();
      } else {
        this.effects.clear();
        this.paddle.w = PADDLE_BASE_W;
        this.balls = [launchBall(this.paddle.x, BASE_SPEED + (this.level - 1) * 12)];
        sfx.alert();
      }
      this.emit();
      return;
    }

    if (this.bricks.length === 0 || isCleared(this.bricks)) {
      this.status = 'clear';
      this.score += 100 * this.level;
      sfx.win();
      this.emit();
      return;
    }

    /* 점수·효과 표시는 자주 바뀌므로 이벤트가 있을 때만 알린다 */
    if (ev.broken > 0 || ev.paddleHit) this.emit();
  }

  /** 화면 좌표를 논리 좌표로 */
  static toField(px: number, width: number) {
    return (px / width) * FIELD_W;
  }

  static readonly W = FIELD_W;
  static readonly H = FIELD_H;
  static readonly PADDLE_Y = PADDLE_Y;
}
