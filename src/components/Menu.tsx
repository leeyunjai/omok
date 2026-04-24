import { useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { Difficulty } from '../game/types';

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
          <div className="flex gap-2">
            {(['easy','normal','hard'] as Difficulty[]).map(d => (
              <button key={d} onClick={() => setDiff(d)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  diff===d ? 'bg-amber-500 text-stone-900' : 'bg-stone-700 text-amber-200 hover:bg-stone-600'
                }`}>
                {d==='easy'?'쉬움':d==='normal'?'보통':'어려움'}
              </button>
            ))}
          </div>
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
