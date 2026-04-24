# 오목 (Gomoku)

브라우저에서 바로 즐기는 오목 — AI 대전 · 2인 로컬 · 서버 없음

## 게임 모드

- **AI 대전** — 흑(플레이어) vs 백(AI), 난이도 3단계 선택
- **2인 대국** — 로컬에서 번갈아 착수

## 난이도

| 레벨 | 알고리즘 | 탐색 깊이 |
|------|----------|----------|
| 쉬움 | Random | depth 1 |
| 보통 | Minimax + Alpha-Beta | depth 3 |
| 어려움 | Minimax + Alpha-Beta | depth 5 |

## 기능

- 15×15 바둑판, 화점(星) 표시
- 마지막 착수 위치 빨간 점 표시
- 무르기 (히스토리 기반)
- 승리 감지 (5목 이상)
- 모바일 터치 지원
- 100% 오프라인 실행

## 기술 스택

- React 18 + TypeScript
- Zustand (상태 관리)
- Tailwind CSS
- Vite

## 로컬 실행

```bash
npm install
npm run dev
```
