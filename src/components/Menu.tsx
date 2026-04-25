import { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { Difficulty } from '../game/types';
import { DIFFICULTY_HINTS, DIFFICULTY_LABELS, DIFFICULTY_ORDER } from '../game/difficulty';

export function Menu() {
  const [diff, setDiff] = useState<Difficulty>('normal');
  const start = useGameStore(s => s.startGame);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-900 text-amber-100 px-4">
      <div className="text-center mb-10">
        <h1 className="text-6xl font-bold mb-2" style={{fontFamily:'serif',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>오목</h1>
        <p className="text-amber-400 text-lg tracking-widest">GOMOKU · 五目</p>
      </div>
      <div className="bg-stone-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl space-y-6">
        <div>
          <p className="text-amber-300 text-sm mb-3 font-semibold tracking-wider">AI 난이도</p>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_ORDER.map(d => (
              <button key={d} onClick={() => setDiff(d)}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors border ${
                  diff===d
                    ? 'bg-amber-500 text-stone-900 border-amber-400'
                    : 'bg-stone-700 text-amber-200 hover:bg-stone-600 border-stone-600'
                }`}>
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-2">
            선택됨: <span className="text-amber-300 font-semibold">{DIFFICULTY_LABELS[diff]}</span> · {DIFFICULTY_HINTS[diff]}
          </p>
        </div>
        <div className="space-y-3">
          <button onClick={() => start('vs-ai', diff)}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-stone-900 font-bold rounded-xl text-lg transition-colors shadow-lg">
            🤖 AI와 대국
          </button>
          <button onClick={() => start('vs-human')}
            className="w-full py-3 bg-stone-600 hover:bg-stone-500 text-amber-100 font-bold rounded-xl text-lg transition-colors">
            👥 2인 대국
          </button>
        </div>
        <p className="text-center text-stone-500 text-xs">검은 돌부터 시작 · 100% 브라우저 실행</p>
      </div>
    </div>
  );
}
