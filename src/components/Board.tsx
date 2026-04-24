import { MouseEvent } from 'react';
import { useGameStore } from '../stores/gameStore';

const CS = 40, PAD = 30, N = 15;
const W = (N - 1) * CS + PAD * 2;
const H = (N - 1) * CS + PAD * 2;
const px = (c: number) => PAD + c * CS;
const py = (r: number) => PAD + r * CS;

const STAR: [number, number][] = [
  [3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]
];

function Stone({ color, x, y, last }: { color: 'black' | 'white'; x: number; y: number; last: boolean }) {
  const R = 17;
  const [fId, rId] = color === 'black' ? ['bFace', 'bRim'] : ['wFace', 'wRim'];
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={R + 2} cx={1} cy={3} fill="rgba(0,0,0,0.35)" />
      <circle r={R} fill={`url(#${rId})`} stroke={color === 'black' ? '#111' : '#aaa'} strokeWidth={1.5} />
      <circle r={R - 2} fill={`url(#${fId})`} />
      <ellipse cx={-5} cy={-7} rx={6} ry={4} fill="white" opacity={color === 'black' ? 0.5 : 0.7} />
      {last && <circle r={4} fill={color === 'black' ? 'rgba(255,80,80,0.9)' : 'rgba(200,0,0,0.8)'} />}
    </g>
  );
}

export function Board() {
  const { board, selectCell, status, lastMove } = useGameStore();
  const disabled = status !== 'playing';

  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (disabled) return;
    const svg = e.currentTarget;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const sp = pt.matrixTransform(ctm.inverse());
    const col = Math.round((sp.x - PAD) / CS);
    const row = Math.round((sp.y - PAD) / CS);
    if (row >= 0 && row < N && col >= 0 && col < N) selectCell(row, col);
  };

  const gridLines = [];
  for (let i = 0; i < N; i++) {
    gridLines.push(
      <line key={`v${i}`} x1={px(i)} y1={py(0)} x2={px(i)} y2={py(N-1)} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />,
      <line key={`h${i}`} x1={px(0)} y1={py(i)} x2={px(N-1)} y2={py(i)} stroke="rgba(0,0,0,0.5)" strokeWidth={1} />
    );
  }

  return (
    <div className="w-full h-full flex justify-center items-center"
      style={{ filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.85))' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: '100%', maxWidth: W, maxHeight: H, display: 'block', cursor: disabled ? 'default' : 'pointer' }}
        onClick={handleClick}
      >
        <defs>
          <radialGradient id="bFace" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#555" />
            <stop offset="60%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#000" />
          </radialGradient>
          <radialGradient id="bRim" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#666" />
            <stop offset="100%" stopColor="#111" />
          </radialGradient>
          <radialGradient id="wFace" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="50%" stopColor="#f0ede0" />
            <stop offset="100%" stopColor="#d0c8b0" />
          </radialGradient>
          <radialGradient id="wRim" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8f5e8" />
            <stop offset="100%" stopColor="#b0a888" />
          </radialGradient>
          <linearGradient id="board" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f2d258" />
            <stop offset="50%" stopColor="#d4a020" />
            <stop offset="100%" stopColor="#a07808" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill="#8a6010" rx={8} />
        <rect x={4} y={4} width={W - 8} height={H - 8} fill="url(#board)" rx={6} />

        {gridLines}

        {STAR.map(([r, c]) => (
          <circle key={`s${r}${c}`} cx={px(c)} cy={py(r)} r={3} fill="rgba(0,0,0,0.55)" />
        ))}

        {board.map((row, r) => row.map((color, c) => {
          if (!color) return null;
          const isLast = lastMove?.row === r && lastMove?.col === c;
          return <Stone key={`${r}-${c}`} color={color} x={px(c)} y={py(r)} last={isLast} />;
        }))}
      </svg>
    </div>
  );
}
