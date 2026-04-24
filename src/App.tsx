import { Component, ReactNode } from 'react';
import { useGameStore } from './stores/gameStore';
import { Board } from './components/Board';
import { Menu } from './components/Menu';
import { GameInfo } from './components/GameInfo';

class ErrorBoundary extends Component<{children:ReactNode},{error:string|null}> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center p-8">
        <div className="bg-red-900 text-red-200 rounded-xl p-6 max-w-lg w-full">
          <h2 className="text-lg font-bold mb-2">오류 발생</h2>
          <pre className="text-xs whitespace-pre-wrap break-all">{this.state.error}</pre>
          <button className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-sm"
            onClick={() => window.location.reload()}>새로고침</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

function GameApp() {
  const status = useGameStore(s => s.status);
  const goToMenu = useGameStore(s => s.goToMenu);
  if (status === 'menu') return <Menu />;
  return (
    <div className="flex flex-col items-center px-2 py-2 gap-2 overflow-hidden select-none"
      style={{height:'100dvh',background:'radial-gradient(ellipse at 50% 0%,#2a1a08 0%,#140d04 60%,#0a0602 100%)'}}>
      <div className="pointer-events-none absolute inset-0 opacity-10" style={{
        backgroundImage:
          'repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(180,140,60,0.15) 40px,rgba(180,140,60,0.15) 41px),'+
          'repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(180,140,60,0.1) 40px,rgba(180,140,60,0.1) 41px)'
      }} />
      <div className="w-full max-w-2xl flex items-center shrink-0 relative z-10">
        <button onClick={goToMenu} className="text-amber-600 hover:text-amber-400 text-sm px-2 py-1 rounded">← 메뉴</button>
        <div className="flex-1 text-center">
          <h1 className="text-amber-400 text-base font-bold tracking-widest"
            style={{fontFamily:'serif',textShadow:'0 0 12px rgba(255,180,40,0.6)'}}>오목 · Gomoku</h1>
          <div className="text-xs text-amber-800 tracking-widest" style={{fontFamily:'serif'}}>五目</div>
        </div>
        <div className="w-14" />
      </div>
      <div className="flex-1 w-full max-w-2xl flex flex-col gap-2 min-h-0 relative z-10">
        <div className="flex-1 min-h-0 flex items-center justify-center"><Board /></div>
        <div className="shrink-0"><GameInfo /></div>
      </div>
    </div>
  );
}

export default function App() {
  return <ErrorBoundary><GameApp /></ErrorBoundary>;
}
