import { useCallback, useEffect, useRef, useState } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { gameById } from '../../shared/registry';
import { breakoutTutorial } from './tutorial';
import { BreakoutGame, Hud } from './game';
import { FIELD_H, FIELD_W, PADDLE_H, PADDLE_Y } from './engine';
import { getBest, submitBest } from '../../shared/records';

const meta = gameById('breakout');

const BRICK_COLORS = ['#5eead4', '#38bdf8', '#c084fc'];
const ITEM_COLORS: Record<string, string> = { wide: '#4ade80', slow: '#60a5fa', multi: '#fbbf24' };
const EFFECT_LABEL: Record<string, string> = { wide: '넓은 패들', slow: '느린 공', multi: '멀티볼' };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BreakoutGame | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [best, setBest] = useState(() => getBest('breakout', 'score'));

  if (!gameRef.current) gameRef.current = new BreakoutGame();
  const game = gameRef.current;

  useEffect(() => {
    game.onHud = (h) => {
      setHud(h);
      if (h.status === 'over') {
        submitBest('breakout', 'score', h.score, `${h.score.toLocaleString()}점 · ${h.level}판`, true);
        submitBest('breakout', 'default', h.score, `${h.score.toLocaleString()}점 · ${h.level}판`, true);
        setBest(getBest('breakout', 'score'));
      }
    };
    setHud(game.hud());
  }, [game]);

  /* 그리기 + 진행 */
  useEffect(() => {
    let raf = 0;
    let prev = performance.now();

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
      }
      const scale = (canvas.width / FIELD_W);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, FIELD_W, FIELD_H);

      /* 벽돌 */
      for (const b of game.bricks) {
        ctx.fillStyle = BRICK_COLORS[Math.min(b.hp, BRICK_COLORS.length) - 1] ?? BRICK_COLORS[0];
        ctx.globalAlpha = b.hp >= 3 ? 1 : b.hp === 2 ? 0.92 : 0.8;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(b.x, b.y, b.w, 2);
      }

      /* 아이템 */
      for (const it of game.items) {
        ctx.fillStyle = ITEM_COLORS[it.kind] ?? '#fff';
        ctx.beginPath();
        ctx.arc(it.x, it.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 패들 */
      ctx.fillStyle = '#e2f5f2';
      ctx.beginPath();
      ctx.roundRect(game.paddle.x - game.paddle.w / 2, PADDLE_Y, game.paddle.w, PADDLE_H, 5);
      ctx.fill();

      /* 공 */
      ctx.fillStyle = '#fff';
      for (const b of game.balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      const dt = now - prev;
      prev = now;
      game.update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [game]);

  /* 키보드 */
  useEffect(() => {
    const held = { left: false, right: false };
    let raf = 0;
    const tick = () => {
      if (held.left) game.nudge(-1);
      if (held.right) game.nudge(1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); held.left = true; }
      if (e.key === 'ArrowRight') { e.preventDefault(); held.right = true; }
      if (e.key === ' ' || e.key === 'p' || e.key === 'P') { e.preventDefault(); game.togglePause(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); game.start(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') held.left = false;
      if (e.key === 'ArrowRight') held.right = false;
    };
    const blur = () => { held.left = held.right = false; game.pause(); };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [game]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) game.pause(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [game]);

  /* 손가락으로 패들 옮기기 */
  const dragging = useRef(false);
  const moveTo = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    game.movePaddle(BreakoutGame.toField(clientX - rect.left, rect.width));
  }, [game]);

  const status = hud?.status ?? 'ready';

  return (
    <GameShell
      meta={meta}
      tutorial={breakoutTutorial}
      actions={
        <button className="shell-btn" onClick={() => game.togglePause()} aria-label="일시정지">
          {status === 'paused' ? '▶' : '⏸'}
        </button>
      }
    >
      <div className="bo-root">
        <div className="bo-stats">
          <span>점수 <strong>{(hud?.score ?? 0).toLocaleString()}</strong></span>
          <span>{hud?.level ?? 1}판</span>
          <span className="bo-lives">{'●'.repeat(Math.max(0, hud?.lives ?? 3))}</span>
          <span className="bo-right">
            <span className="bo-effects">
              {(hud?.effects ?? []).map((e) => (
                <span key={e.kind} className="bo-chip">{EFFECT_LABEL[e.kind]} {e.left}s</span>
              ))}
            </span>
          </span>
        </div>

        <div className="bo-stage">
          <canvas
            ref={canvasRef}
            className="bo-canvas"
            style={{ aspectRatio: `${FIELD_W} / ${FIELD_H}`, height: '100%' }}
            aria-label="벽돌깨기 판"
            onPointerDown={(e) => { dragging.current = true; moveTo(e.clientX); }}
            onPointerMove={(e) => { if (dragging.current) moveTo(e.clientX); }}
            onPointerUp={() => { dragging.current = false; }}
            onPointerCancel={() => { dragging.current = false; }}
          />

          {status !== 'playing' && (
            <div className="bo-overlay fade-in">
              {status === 'ready' && (
                <>
                  <h2>벽돌깨기</h2>
                  <p>{meta.lore.map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}</p>
                  <button className="bo-btn" onClick={() => game.start()}>시작하기</button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <h2>일시정지</h2>
                  <button className="bo-btn" onClick={() => game.resume()}>이어하기</button>
                </>
              )}
              {status === 'clear' && (
                <>
                  <h2>{hud?.level ?? 1}판 통과</h2>
                  <p>점수 {(hud?.score ?? 0).toLocaleString()}</p>
                  <button className="bo-btn" onClick={() => game.nextLevel()}>다음 판</button>
                </>
              )}
              {status === 'over' && (
                <>
                  <h2>게임 오버</h2>
                  <p>
                    {(hud?.score ?? 0).toLocaleString()}점 · {hud?.level ?? 1}판까지
                    {best ? <><br />최고 {best.value.toLocaleString()}점</> : null}
                  </p>
                  <button className="bo-btn" onClick={() => game.start()}>다시 하기</button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="bo-controls">
          <button onPointerDown={() => game.nudge(-1)} aria-label="왼쪽">←</button>
          <button onClick={() => game.togglePause()}>{status === 'paused' ? '▶ 계속' : '⏸ 정지'}</button>
          <button onClick={() => game.start()}>⟳ 새 게임</button>
          <button onPointerDown={() => game.nudge(1)} aria-label="오른쪽">→</button>
        </div>
      </div>
    </GameShell>
  );
}
