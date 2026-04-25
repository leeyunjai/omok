import { Difficulty } from './types';

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '쉬움',
  normal: '중간',
  hard: '어려움',
};

export const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy: '랜덤 착수 위주',
  normal: '균형형 AI',
  hard: '깊게 탐색',
};

export const DIFFICULTY_DEPTH: Record<Difficulty, number> = {
  easy: 1,
  normal: 3,
  hard: 5,
};

export const DIFFICULTY_MOVE_LIMIT: Record<Difficulty, number> = {
  easy: 1,
  normal: 10,
  hard: 20,
};
