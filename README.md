# 오목 (Gomoku)

브라우저에서 바로 즐기는 오목 — AI 대전 · 2인 로컬 · 서버 없음

## 게임 모드

- **AI 대전** — 흑(플레이어) vs 백(AI), 난이도 3단계 선택
- **2인 대국** — 로컬에서 번갈아 착수

## 난이도

| 레벨 | 알고리즘 | 탐색 깊이 |
|------|----------|----------|
| 쉬움 | Random | depth 1 |
| 중간 | Minimax + Alpha-Beta | depth 3 |
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

## GitHub Pages 배포 (gh-pages 브랜치)

이 프로젝트는 `vite.config.ts`에서 프로덕션 `base`를 `./`로 설정해, 저장소 이름이 달라도 정적 파일 경로가 깨지지 않게 구성했습니다.

1. GitHub 저장소의 **Settings → Pages**에서 Source를 **Deploy from a branch**로 선택
2. Branch를 **gh-pages / (root)** 로 지정
3. 기본 브랜치(`main`/`master`) 또는 작업 브랜치(`work`)에 푸시하면 GitHub Actions가 자동 빌드 후 `gh-pages` 브랜치에 배포

직접 수동 배포(빌드 후 gh-pages 브랜치 업로드):

```bash
npm install
npm run deploy
```

`npm run deploy`는 내부적으로 `npm run build`를 먼저 실행한 뒤, `dist` 결과물을 `gh-pages` 브랜치로 푸시합니다.

### 배포 후 화면이 안 보일 때

- GitHub Actions 탭에서 `Deploy to GitHub Pages` 워크플로우가 성공했는지 먼저 확인
- 브라우저 강력 새로고침(Windows/Linux: `Ctrl+Shift+R`, macOS: `Cmd+Shift+R`)으로 캐시 제거
- Pages 설정이 반드시 `gh-pages / root`인지 확인
