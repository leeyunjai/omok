import { useMemo } from 'react';
import { GameShell } from '../../shared/react/GameShell';
import { useKeys } from '../../shared/react/useKeys';
import { gameById } from '../../shared/registry';
import { yutTutorial } from './tutorial';
import { loadSavedGame, movesForPiece, useYut } from './store';
import { NODES, OUTER_RING, VIEW } from './board';
import {
  PIECES_PER_SIDE, Player, START, THROW_LABEL, Throw, legalMoves,
} from './engine';
import { DIFFICULTY_LABEL, Difficulty } from './ai';

const meta = gameById('yut');
const SIDE_LABEL: Record<Player, string> = { blue: '청', red: '홍' };

function Menu() {
  const startGame = useYut((s) => s.startGame);
  const resumeSaved = useYut((s) => s.resumeSaved);
  const difficulty = useYut((s) => s.difficulty);
  const playerSide = useYut((s) => s.playerSide);
  const setPref = useYut((s) => s.setPref);
  const saved = loadSavedGame();

  return (
    <div className="yt-menu">
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

function Board() {
  const game = useYut((s) => s.game);
  const selected = useYut((s) => s.selected);
  const phase = useYut((s) => s.phase);
  const mode = useYut((s) => s.mode);
  const playerSide = useYut((s) => s.playerSide);
  const selectPiece = useYut((s) => s.selectPiece);
  const playMove = useYut((s) => s.playMove);

  const myTurn = mode === 'vs-human' || game.turn === playerSide;
  const moves = useMemo(() => (phase === 'moving' ? legalMoves(game) : []), [game, phase]);

  /* 고른 말이 갈 수 있는 자리 */
  const targets = useMemo(() => {
    if (selected === null) return new Map<string, Throw>();
    const map = new Map<string, Throw>();
    for (const m of movesForPiece(game, selected)) map.set(m.to, m.throw);
    return map;
  }, [game, selected]);

  const movablePieceIds = useMemo(() => new Set(moves.map((m) => m.pieceId)), [moves]);

  /* 칸마다 말 모아 두기 */
  const byNode = new Map<string, { owner: Player; count: number; ids: number[] }>();
  for (const p of game.pieces) {
    if (p.done || p.node === START) continue;
    const cur = byNode.get(p.node);
    if (cur) { cur.count += 1; cur.ids.push(p.id); }
    else byNode.set(p.node, { owner: p.owner, count: 1, ids: [p.id] });
  }

  const onNode = (node: string) => {
    if (!myTurn || phase !== 'moving') return;
    const t = targets.get(node);
    if (t !== undefined && selected !== null) {
      const move = movesForPiece(game, selected).find((m) => m.to === node && m.throw === t);
      if (move) { playMove(move); return; }
    }
    const here = byNode.get(node);
    if (here && here.owner === game.turn && here.ids.some((id) => movablePieceIds.has(id))) {
      selectPiece(here.ids.find((id) => movablePieceIds.has(id))!);
    }
  };

  return (
    <svg className="yt-board" viewBox={`0 0 ${VIEW} ${VIEW}`} role="application" aria-label="윷판">
      <defs>
        <radialGradient id="ytBlue" cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#bcd8ff" />
          <stop offset="100%" stopColor="#2f5fa8" />
        </radialGradient>
        <radialGradient id="ytRed" cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffc2b8" />
          <stop offset="100%" stopColor="#a83a2f" />
        </radialGradient>
      </defs>

      {/* 바깥 길 */}
      <polygon
        className="yt-link"
        points={OUTER_RING.map((n) => `${n.x},${n.y}`).join(' ')}
      />
      {/* 지름길 */}
      <line className="yt-link" x1={NODES.o4.x} y1={NODES.o4.y} x2={NODES.o14.x} y2={NODES.o14.y} />
      <line className="yt-link" x1={NODES.o9.x} y1={NODES.o9.y} x2={NODES.o19.x} y2={NODES.o19.y} />

      {/* 칸 */}
      {Object.values(NODES).map((n) => {
        const isTarget = targets.has(n.id);
        const r = n.corner || n.center ? 13 : 9;
        return (
          <g key={n.id} onClick={() => onNode(n.id)} style={{ cursor: isTarget ? 'pointer' : 'default' }}>
            <circle
              className={`yt-node${n.corner ? ' corner' : ''}${n.center ? ' center' : ''}${isTarget ? ' target' : ''}`}
              cx={n.x} cy={n.y} r={r}
            />
            {isTarget && (
              <text x={n.x} y={n.y - r - 3} textAnchor="middle" className="yt-label" style={{ fill: '#34d399' }}>
                {THROW_LABEL[targets.get(n.id)!]}
              </text>
            )}
          </g>
        );
      })}

      {/* 참먹이 표시 */}
      <text x={NODES.o19.x} y={NODES.o19.y + 26} textAnchor="middle" className="yt-label">참먹이</text>

      {/* 말 */}
      {[...byNode.entries()].map(([node, info]) => {
        const n = NODES[node];
        if (!n) return null;
        const isSel = selected !== null && info.ids.includes(selected);
        return (
          <g
            key={node}
            className={`yt-piece ${info.owner}${isSel ? ' sel' : ''}`}
            onClick={() => onNode(node)}
          >
            <circle className="disc" cx={n.x} cy={n.y} r={11} />
            {info.count > 1 && (
              <text x={n.x} y={n.y + 3} textAnchor="middle">{info.count}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Game() {
  const game = useYut((s) => s.game);
  const selected = useYut((s) => s.selected);
  const selectPiece = useYut((s) => s.selectPiece);
  const phase = useYut((s) => s.phase);
  const mode = useYut((s) => s.mode);
  const playerSide = useYut((s) => s.playerSide);
  const lastThrow = useYut((s) => s.lastThrow);
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
  const movable = phase === 'moving' ? legalMoves(game) : [];
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
      <div className="yt-status" aria-live="polite">
        <span className={`yt-side ${game.turn}`}>{SIDE_LABEL[game.turn]}</span>
        <span>{mode === 'vs-ai' ? (myTurn ? '내 차례' : 'AI 차례') : '차례'}</span>
        {aiThinking && <span style={{ color: '#f0873c' }}>생각 중…</span>}
        <span className="yt-throws">
          {game.pending.map((t, i) => <span key={i} className="yt-chip">{THROW_LABEL[t]}</span>)}
        </span>
        <span className="yt-right">
          {mode === 'vs-ai' ? `AI · ${DIFFICULTY_LABEL[useYut.getState().difficulty]}` : '2인'}
        </span>
      </div>

      <div className="yt-board-wrap"><Board /></div>

      <div className="yt-tray">
        {(['blue', 'red'] as Player[]).map((side) => (
          <button
            key={side}
            className={`yt-tray-btn${waitingSelected(side) ? ' sel' : ''}`}
            onClick={() => pickWaiting(side)}
            aria-label={`${SIDE_LABEL[side]} 대기 말 고르기`}
          >
            <span className={`yt-side ${side}`}>{SIDE_LABEL[side]}</span>
            <span className="yt-tray-row">
              {Array.from({ length: PIECES_PER_SIDE }, (_, i) => (
                <span key={i} className={`yt-dot ${side}${i < waiting(side) ? '' : ' ghost'}`} />
              ))}
            </span>
            <span>완주 {done(side)}</span>
          </button>
        ))}
      </div>

      <div className="yt-log">
        {message ? <span style={{ color: '#ffb37a' }}>{message}</span> : log.slice(0, 3).map((l, i) => <span key={i}>{l}</span>)}
      </div>

      <div className="yt-controls">
        <button
          className="primary"
          onClick={rollDice}
          disabled={!myTurn || phase !== 'throwing' || aiThinking}
        >
          🎲 던지기{lastThrow && phase === 'throwing' ? ` (직전 ${THROW_LABEL[lastThrow]})` : ''}
        </button>
        <button onClick={restart}>⟳ 새 판</button>
        <button onClick={goToMenu}>메뉴</button>
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

  useKeys({
    n: () => { if (phase !== 'menu') restart(); },
    Escape: () => { if (phase !== 'menu') goToMenu(); },
  });

  return (
    <GameShell meta={meta} tutorial={yutTutorial}>
      {phase === 'menu' ? <Menu /> : <><Game /><Result /></>}
    </GameShell>
  );
}
