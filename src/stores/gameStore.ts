import { create } from 'zustand';
import { BoardState, Difficulty, GameMode, GameStatus, PieceColor, Position } from '../game/types';
import { createInitialBoard, cloneBoard } from '../game/board';
import { checkWin } from '../game/moves';
import { getBestMove } from '../game/ai';

interface Snap { board: BoardState; cur: PieceColor; moveCount: number; }

interface Store {
  board: BoardState;
  currentPlayer: PieceColor;
  status: GameStatus;
  winner: PieceColor | null;
  mode: GameMode;
  difficulty: Difficulty;
  aiThinking: boolean;
  moveCount: number;
  history: Snap[];
  lastMove: Position | null;
  startGame: (mode: GameMode, difficulty?: Difficulty) => void;
  selectCell: (row: number, col: number) => void;
  undoMove: () => void;
  goToMenu: () => void;
}

function init() {
  return {
    board: createInitialBoard(),
    currentPlayer: 'black' as PieceColor,
    status: 'menu' as GameStatus,
    winner: null as PieceColor | null,
    mode: 'vs-ai' as GameMode,
    difficulty: 'normal' as Difficulty,
    aiThinking: false,
    moveCount: 0,
    history: [] as Snap[],
    lastMove: null as Position | null,
  };
}

export const useGameStore = create<Store>()((set, get) => ({
  ...init(),

  startGame: (mode, difficulty = 'normal') =>
    set({ ...init(), status: 'playing', mode, difficulty }),

  selectCell: (row, col) => {
    const s = get();
    if (s.status !== 'playing' || s.aiThinking || s.board[row][col] !== null) return;
    const snap: Snap = { board: s.board.map(r=>[...r]), cur: s.currentPlayer, moveCount: s.moveCount };
    const nb = cloneBoard(s.board);
    nb[row][col] = s.currentPlayer;
    const won = checkWin(nb, row, col, s.currentPlayer);
    const next: PieceColor = s.currentPlayer === 'black' ? 'white' : 'black';
    if (won) {
      set({ board:nb, status:'ended', winner:s.currentPlayer, moveCount:s.moveCount+1,
            history:[...s.history,snap], lastMove:{row,col} });
      return;
    }
    set({ board:nb, currentPlayer:next, moveCount:s.moveCount+1,
          history:[...s.history,snap], lastMove:{row,col} });
    if (s.mode === 'vs-ai' && next === 'white') {
      set({ aiThinking: true });
      setTimeout(() => {
        const st = get();
        const mv = getBestMove(st.board, 'white', st.difficulty);
        if (!mv) { set({ aiThinking:false, status:'ended', winner:'black' }); return; }
        const ab = cloneBoard(st.board);
        ab[mv.row][mv.col] = 'white';
        const aw = checkWin(ab, mv.row, mv.col, 'white');
        set({ board:ab, currentPlayer:'black', moveCount:st.moveCount+1,
              status:aw?'ended':'playing', winner:aw?'white':null,
              aiThinking:false, lastMove:mv });
      }, 200);
    }
  },

  undoMove: () => {
    const { history, aiThinking } = get();
    if (aiThinking || !history.length) return;
    const p = history[history.length-1];
    set({ board:p.board, currentPlayer:p.cur, moveCount:p.moveCount,
          history:history.slice(0,-1), status:'playing', winner:null, lastMove:null });
  },

  goToMenu: () => set({ status:'menu' }),
}));
