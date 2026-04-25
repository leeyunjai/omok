import { useGameStore } from '../stores/gameStore';

export function GameInfo() {
  const { currentPlayer, status, winner, aiThinking, moveCount, goToMenu, undoMove, history } = useGameStore();
  return (
    <div className="bg-stone-800 rounded-xl p-4 text-amber-100 text-sm space-y-3">
      {status === 'playing' && (
        <div className="flex items-center gap-2">
          <span className="text-stone-400">차례:</span>
          <span className={currentPlayer==='black'?'text-stone-300 font-bold':'text-amber-100 font-bold'}>
            {currentPlayer==='black'?'● 검은':'○ 흰'}
          </span>
          {aiThinking && <span className="text-amber-500 text-xs animate-pulse">AI 생각 중…</span>}
        </div>
      )}
      {status === 'ended' && winner && (
        <div className="text-center py-2">
          <div className="text-2xl mb-1">🌟</div>
          <div>
            <span className={winner==='black'?'text-stone-300':'text-amber-100'}>
              {winner==='black'?'검은 돌':'흰 돌'}
            </span>
            <span className="text-amber-200"> 승리!</span>
          </div>
        </div>
      )}
      <div className="text-stone-400 text-xs">수: {moveCount}</div>
      <div className="flex gap-2 pt-1">
        <button onClick={goToMenu}
          className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 text-amber-200 rounded-lg text-xs transition-colors">
          메뉴
        </button>
        <button onClick={undoMove} disabled={!history.length || aiThinking || status!=='playing'}
          className="flex-1 py-2 bg-stone-700 hover:bg-stone-600 text-amber-200 rounded-lg text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          무르기 ↩
        </button>
      </div>
    </div>
  );
}
