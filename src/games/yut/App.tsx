import { useMemo } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { useKeys } from '../../shared/react/useKeys';
import { gameById } from '../../shared/registry';
import { yutTutorial } from './tutorial';
import { loadSavedGame, movesForPiece, useYut } from './store';
import { EXIT, NODES, OUTER_RING, VIEW, VIEW_BOX } from './board';
import {
  GOAL, PIECES_PER_SIDE, Player, START, THROW_LABEL, Throw, legalMoves,
} from './engine';
import { DIFFICULTY_LABEL, Difficulty } from './ai';

const meta = gameById('yut');
const SIDE_LABEL: Record<Player, string> = { blue: '청', red: '홍' };

/* ────────────────────────── 윷가락 ────────────────────────── */

/** 던질 때마다 조금씩 다르게 눕도록 — 같은 판을 다시 그려도 흔들리지 않게 결정적으로 */
const tiltOf = (throwId: number, i: number) => ((throwId * 37 + i * 61) % 13) - 6;

function Sticks() {
  const sticks = useYut((s) => s.sticks);
  const rolling = useYut((s) => s.rolling);
  const throwId = useYut((s) => s.throwId);
  const lastThrow = useYut((s) => s.lastThrow);

  if (sticks.length === 0) {
    return (
      <div className="yt-throwpad empty">
        <div className="yt-sticks">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`yt-stick idle${i === 0 ? ' marked' : ''}`}>
              <span className="face flat" />
              <span className="face round" />
            </span>
          ))}
        </div>
        <span className="yt-throw-hint">윷을 던져 시작하세요</span>
      </div>
    );
  }

  const flats = sticks.filter(Boolean).length;
  return (
    <div className="yt-throwpad">
      <div className="yt-sticks" key={throwId}>
        {sticks.map((flat, i) => (
          <span
            key={i}
            className={`yt-stick${i === 0 ? ' marked' : ''}`}
            style={{
              ['--end' as string]: flat ? '0deg' : '180deg',
              ['--tilt' as string]: `${tiltOf(throwId, i)}deg`,
              ['--delay' as string]: `${i * 55}ms`,
            }}
          >
            <span className="face flat" />
            <span className="face round" />
          </span>
        ))}
      </div>
      <div className="yt-throw-out" aria-live="polite">
        {rolling ? (
          <span className="yt-throw-rolling">구르는 중…</span>
        ) : (
          lastThrow && (
            <span key={throwId} className="yt-throw-name pop-in">
              {THROW_LABEL[lastThrow]}
              <em>{lastThrow === 'backdo' ? '뒤로 한 칸' : `배 ${flats}개`}</em>
            </span>
          )
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── 메뉴 ────────────────────────── */

function Menu() {
  const startGame = useYut((s) => s.startGame);
  const resumeSaved = useYut((s) => s.resumeSaved);
  const difficulty = useYut((s) => s.difficulty);
  const playerSide = useYut((s) => s.playerSide);
  const setPref = useYut((s) => s.setPref);
  const saved = loadSavedGame();

  return (
    <div className="yt-menu center-scroll">
      <div className="yt-menu-art" aria-hidden>
        <div className="yt-sticks">
          {[true, false, true, true].map((flat, i) => (
            <span
              key={i}
              className={`yt-stick idle${i === 0 ? ' marked' : ''}`}
              style={{
                ['--end' as string]: flat ? '0deg' : '180deg',
                ['--tilt' as string]: `${(i - 1.5) * 5}deg`,
              }}
            >
              <span className="face flat" />
              <span className="face round" />
            </span>
          ))}
        </div>
      </div>

      <p className="yt-lore">
        {meta.lore.map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
      </p>

      <div className="yt-card">
        {saved && (
          <button className="yt-start resume" onClick={resumeSaved}>
            ▶ 이어하기 ({saved.game.pieces.filter((p) => p.done).length}말 완주)
          </button>
        )}

        <div className="yt-field">
          <p>AI 실력</p>
          <div className="yt-options">
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
              <button key={d} aria-pressed={difficulty === d} onClick={() => setPref({ difficulty: d })}>
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="yt-field">
          <p>내 편</p>
          <div className="yt-options">
            <button aria-pressed={playerSide === 'blue'} onClick={() => setPref({ playerSide: 'blue' })}>청 (선공)</button>
            <button aria-pressed={playerSide === 'red'} onClick={() => setPref({ playerSide: 'red' })}>홍 (후공)</button>
          </div>
        </div>

        <button className="yt-start" onClick={() => startGame('vs-ai')}>🤖 AI와 대국</button>
        <button className="yt-start ghost" onClick={() => startGame('vs-human')}>👥 2인 대국</button>
      </div>
    </div>
  );
}

/* ────────────────────────── 판 ────────────────────────── */

function Board() {
  const game = useYut((s) => s.game);
  const selected = useYut((s) => s.selected);
  const phase = useYut((s) => s.phase);
  const rolling = useYut((s) => s.rolling);
  const mode = useYut((s) => s.mode);
  const fx = useYut((s) => s.fx);
  const playerSide = useYut((s) => s.playerSide);
  const selectPiece = useYut((s) => s.selectPiece);
  const playMove = useYut((s) => s.playMove);

  const myTurn = mode === 'vs-human' || game.turn === playerSide;
  const moves = useMemo(
    () => (phase === 'moving' && !rolling ? legalMoves(game) : []),
    [game, phase, rolling]
  );

  /* 고른 말이 갈 수 있는 자리 */
  const targets = useMemo(() => {
    if (selected === null || moves.length === 0) return new Map<string, Throw>();
    const map = new Map<string, Throw>();
    for (const m of movesForPiece(game, selected)) map.set(m.to, m.throw);
    return map;
  }, [game, selected, moves.length]);

  const movablePieceIds = useMemo(() => new Set(moves.map((m) => m.pieceId)), [moves]);
  /* 고른 말이 지금 날 수 있는가 */
  const goalThrow = targets.get(GOAL);

  /* 칸마다 말 모아 두기 — 겹쳐 놓인 말의 수를 세고 누를 대상을 정한다 */
  const byNode = new Map<string, number[]>();
  for (const p of game.pieces) {
    if (p.done || p.node === START) continue;
    const cur = byNode.get(p.node);
    if (cur) cur.push(p.id);
    else byNode.set(p.node, [p.id]);
  }

  const onNode = (node: string) => {
    if (!myTurn || phase !== 'moving' || rolling) return;
    const t = targets.get(node);
    if (t !== undefined && selected !== null) {
      const move = movesForPiece(game, selected).find((m) => m.to === node && m.throw === t);
      if (move) { playMove(move); return; }
    }
    const ids = byNode.get(node);
    if (!ids) return;
    const owner = game.pieces.find((p) => p.id === ids[0])!.owner;
    if (owner === game.turn && ids.some((id) => movablePieceIds.has(id))) {
      selectPiece(ids.find((id) => movablePieceIds.has(id))!);
    }
  };

  const onBoard = game.pieces.filter((p) => !p.done && p.node !== START);

  return (
    <svg className="yt-board" viewBox={VIEW_BOX} role="application" aria-label="윷판">
      <defs>
        <radialGradient id="ytBlue" cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#bcd8ff" />
          <stop offset="55%" stopColor="#5b8fd8" />
          <stop offset="100%" stopColor="#24467c" />
        </radialGradient>
        <radialGradient id="ytRed" cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffc9bd" />
          <stop offset="55%" stopColor="#d95f4b" />
          <stop offset="100%" stopColor="#8c2c22" />
        </radialGradient>
        <linearGradient id="ytWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b2617" />
          <stop offset="45%" stopColor="#4d3220" />
          <stop offset="100%" stopColor="#2c1c11" />
        </linearGradient>
      </defs>

      {/* 판 — 무명천을 깐 나무판 */}
      <rect className="yt-panel" x="4" y="4" width={VIEW - 8} height={VIEW - 8} rx="20" fill="url(#ytWood)" />
      <g className="yt-grain" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M 8 ${34 + i * 62} Q ${VIEW / 2} ${24 + i * 62} ${VIEW - 8} ${36 + i * 62}`}
          />
        ))}
      </g>

      {/* 바깥 길 */}
      <polygon className="yt-link" points={OUTER_RING.map((n) => `${n.x},${n.y}`).join(' ')} />
      {/* 지름길 */}
      <line className="yt-link" x1={NODES.o4.x} y1={NODES.o4.y} x2={NODES.o14.x} y2={NODES.o14.y} />
      <line className="yt-link" x1={NODES.o9.x} y1={NODES.o9.y} x2={NODES.o19.x} y2={NODES.o19.y} />

      {/* 칸 */}
      {Object.values(NODES).map((n) => {
        const isTarget = targets.has(n.id);
        const big = n.corner || n.center;
        const r = big ? 14 : 9.5;
        return (
          <g
            key={n.id}
            className={`yt-station${isTarget ? ' target' : ''}`}
            onClick={() => onNode(n.id)}
            style={{ cursor: isTarget ? 'pointer' : 'default' }}
          >
            {isTarget && <circle className="yt-halo" cx={n.x} cy={n.y} r={r + 7} />}
            <circle
              className={`yt-node${n.corner ? ' corner' : ''}${n.center ? ' center' : ''}${isTarget ? ' target' : ''}`}
              cx={n.x} cy={n.y} r={r}
            />
            {big && <circle className="yt-node-inner" cx={n.x} cy={n.y} r={r - 4.5} />}
            {isTarget && (
              <text x={n.x} y={n.y - r - 5} textAnchor="middle" className="yt-target-label">
                {THROW_LABEL[targets.get(n.id)!]}
              </text>
            )}
          </g>
        );
      })}

      {/* 방 이름 */}
      <text x={NODES.o19.x - 32} y={NODES.o19.y - 23} textAnchor="middle" className="yt-label strong">참먹이</text>
      <text x={NODES.o19.x - 32} y={NODES.o19.y - 13} textAnchor="middle" className="yt-label dim">출발 · 도착</text>
      <text x={NODES.o4.x} y={NODES.o4.y - 19} textAnchor="middle" className="yt-label dim">지름길</text>
      <text x={NODES.o9.x} y={NODES.o9.y - 19} textAnchor="middle" className="yt-label dim">지름길</text>
      <text x={NODES.center.x} y={NODES.center.y + 29} textAnchor="middle" className="yt-label">방</text>

      {/* 나기 — 판을 한 바퀴 돈 말이 빠져나가는 자리.
          도착은 칸이 아니라서 판 위에 그릴 곳이 없었고, 그래서 낼 수가 없었다 */}
      <g
        className={`yt-exit${goalThrow !== undefined ? ' target' : ''}`}
        onClick={() => onNode(GOAL)}
        style={{ cursor: goalThrow !== undefined ? 'pointer' : 'default' }}
      >
        <line className="yt-exit-path" x1={NODES.o19.x} y1={NODES.o19.y} x2={EXIT.x} y2={EXIT.y} />
        {goalThrow !== undefined && <circle className="yt-halo" cx={EXIT.x} cy={EXIT.y} r="21" />}
        {/* 손가락으로 누를 자리는 넉넉하게 */}
        <circle cx={EXIT.x} cy={EXIT.y} r="22" fill="transparent" />
        <circle className="yt-exit-ring" cx={EXIT.x} cy={EXIT.y} r="14" />
        <text x={EXIT.x} y={EXIT.y + 3.5} textAnchor="middle" className="yt-exit-label">
          {goalThrow !== undefined ? THROW_LABEL[goalThrow] : '나기'}
        </text>
      </g>

      {/* 잡았을 때 · 났을 때 잠깐 보이는 표시 */}
      {fx && NODES[fx.node] && (
        <g key={fx.id} className={`yt-fx ${fx.kind}`} aria-hidden>
          <circle cx={NODES[fx.node].x} cy={NODES[fx.node].y} r="12" />
          <text x={NODES[fx.node].x} y={NODES[fx.node].y - 22} textAnchor="middle">
            {fx.kind === 'capture' ? '잡았다!' : '났다!'}
          </text>
        </g>
      )}

      {/* 말 — 칸이 바뀌면 미끄러지듯 옮겨간다 */}
      {onBoard.map((p) => {
        const n = NODES[p.node];
        if (!n) return null;
        const ids = byNode.get(p.node)!;
        const top = ids[ids.length - 1] === p.id;
        const isSel = selected !== null && ids.includes(selected) && top;
        const canMove = movablePieceIds.has(p.id);
        return (
          <g
            key={p.id}
            className={`yt-piece ${p.owner}${isSel ? ' sel' : ''}${canMove && top ? ' movable' : ''}`}
            style={{ transform: `translate(${n.x}px, ${n.y}px)` }}
            onClick={() => onNode(p.node)}
          >
            <ellipse className="shadow" cx="1.5" cy="3" rx="11" ry="10" />
            <circle className="disc" cx="0" cy="0" r="11.5" />
            <circle className="gloss" cx="-3.4" cy="-3.8" r="3.4" />
            {top && ids.length > 1 && <text y="4" textAnchor="middle">{ids.length}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ────────────────────────── 대국 화면 ────────────────────────── */

function Game() {
  const game = useYut((s) => s.game);
  const selected = useYut((s) => s.selected);
  const selectPiece = useYut((s) => s.selectPiece);
  const phase = useYut((s) => s.phase);
  const rolling = useYut((s) => s.rolling);
  const bonus = useYut((s) => s.bonus);
  const mode = useYut((s) => s.mode);
  const difficulty = useYut((s) => s.difficulty);
  const playerSide = useYut((s) => s.playerSide);
  const message = useYut((s) => s.message);
  const aiThinking = useYut((s) => s.aiThinking);
  const log = useYut((s) => s.log);
  const rollDice = useYut((s) => s.rollDice);
  const restart = useYut((s) => s.restart);
  const goToMenu = useYut((s) => s.goToMenu);

  const myTurn = mode === 'vs-human' || game.turn === playerSide;
  const waiting = (owner: Player) => game.pieces.filter((p) => p.node === START && !p.done && p.owner === owner).length;
  const done = (owner: Player) => game.pieces.filter((p) => p.owner === owner && p.done).length;

  /* 대기 중인 말도 눌러서 고를 수 있게 한다 */
  const movable = phase === 'moving' && !rolling ? legalMoves(game) : [];
  const pickWaiting = (side: Player) => {
    if (!myTurn || side !== game.turn) return;
    const move = movable.find((m) => {
      const piece = game.pieces.find((p) => p.id === m.pieceId);
      return piece && piece.node === START;
    });
    if (move) selectPiece(move.pieceId);
  };
  const waitingSelected = (side: Player) => {
    const piece = game.pieces.find((p) => p.id === selected);
    return !!piece && piece.node === START && piece.owner === side;
  };

  return (
    <div className="yt-root">
      <div className="yt-board-wrap"><Board /></div>

      <div className="yt-side-panel">
      <div className="yt-status" aria-live="polite">
        <span className={`yt-turn ${game.turn}`}>
          <span className="yt-dot-lg" />
          {SIDE_LABEL[game.turn]}
        </span>
        <span>{mode === 'vs-ai' ? (myTurn ? '내 차례' : 'AI 차례') : '차례'}</span>
        {aiThinking && <span className="yt-thinking">생각 중…</span>}
        <span className="yt-throws">
          {game.pending.map((t, i) => <span key={i} className="yt-chip">{THROW_LABEL[t]}</span>)}
        </span>
        <span className="yt-right">
          {mode === 'vs-ai' ? `AI · ${DIFFICULTY_LABEL[difficulty]}` : '2인'}
        </span>
      </div>

      <div className="yt-panel-row">
        <Sticks />
        <div className="yt-side-info">
          {(['blue', 'red'] as Player[]).map((side) => (
            <button
              key={side}
              className={`yt-tray-btn ${side}${waitingSelected(side) ? ' sel' : ''}${game.turn === side ? ' turn' : ''}`}
              onClick={() => pickWaiting(side)}
              aria-label={`${SIDE_LABEL[side]} 대기 말 고르기`}
            >
              <span className={`yt-side ${side}`}>{SIDE_LABEL[side]}</span>
              <span className="yt-tray-row">
                {Array.from({ length: PIECES_PER_SIDE }, (_, i) => (
                  <span key={i} className={`yt-dot ${side}${i < waiting(side) ? '' : ' ghost'}`} />
                ))}
              </span>
              <span className="yt-done">난 말 {done(side)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="yt-log">
        {message
          ? <span className="yt-msg">{message}</span>
          : log.slice(0, 3).map((l, i) => <span key={i}>{l}</span>)}
      </div>

      <div className="yt-controls">
        <button
          className={`primary${bonus && phase === 'throwing' ? ' bonus' : ''}`}
          onClick={rollDice}
          disabled={!myTurn || phase !== 'throwing' || rolling || aiThinking}
        >
          {rolling ? '던지는 중…' : bonus ? '🎲 한 번 더!' : '🎲 윷 던지기'}
        </button>
        <button onClick={restart}>⟳ 새 판</button>
        <button onClick={goToMenu}>메뉴</button>
      </div>
      </div>
    </div>
  );
}

function Result() {
  const phase = useYut((s) => s.phase);
  const game = useYut((s) => s.game);
  const mode = useYut((s) => s.mode);
  const playerSide = useYut((s) => s.playerSide);
  const restart = useYut((s) => s.restart);
  const goToMenu = useYut((s) => s.goToMenu);

  if (phase !== 'ended' || !game.winner) return null;
  const won = mode === 'vs-ai' && game.winner === playerSide;

  return (
    <div className="yt-result fade-in" role="dialog" aria-modal="true" aria-label="대국 결과">
      <div className="yt-result-box pop-in">
        <div style={{ fontSize: '2.2rem' }}>{mode === 'vs-ai' ? (won ? '🏆' : '😤') : '🎉'}</div>
        <h2 className={`yt-side ${game.winner}`}>{SIDE_LABEL[game.winner]} 승리</h2>
        <p>네 말을 모두 냈습니다</p>
        <button className="yt-start" onClick={restart}>다시 하기</button>
        <button className="yt-start ghost" onClick={goToMenu}>메뉴로</button>
      </div>
    </div>
  );
}

export default function App() {
  const phase = useYut((s) => s.phase);
  const restart = useYut((s) => s.restart);
  const goToMenu = useYut((s) => s.goToMenu);
  const rollDice = useYut((s) => s.rollDice);

  useKeys({
    ' ': () => { if (phase === 'throwing') rollDice(); },
    n: () => { if (phase !== 'menu') restart(); },
    Escape: () => { if (phase !== 'menu') goToMenu(); },
  });

  return (
    <GameShell meta={meta} tutorial={yutTutorial}>
      {phase === 'menu' ? <Menu /> : <><Game /><Result /></>}
    </GameShell>
  );
}
