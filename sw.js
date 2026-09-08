/* 자동 생성 — vite.config.ts의 pwaPlugin이 만든 파일입니다. 직접 수정하지 마세요. */
const CACHE = 'games-vmtsvtp39';
const PRECACHE = [
  "./assets/hub-CGAH4i6u.css",
  "./assets/omok-CW63LGnl.css",
  "./assets/janggi-rchtNTTd.css",
  "./assets/sudoku-DCS87nix.css",
  "./assets/tetris-DS5gMi7r.css",
  "./assets/reversi-COl8ozkA.css",
  "./assets/kkodle-D4nzxr1i.css",
  "./assets/minesweeper-D1w0K4PM.css",
  "./assets/nonogram-BaJjXNiC.css",
  "./assets/solitaire-CnoJLQW4.css",
  "./assets/g2048-BpiZUr8M.css",
  "./assets/breakout-CKR_KWpI.css",
  "./assets/yut-BKsT7HDa.css",
  "./assets/pwa-BhXXiNf5.css",
  "./assets/hub-FOTq6Hsc.js",
  "./assets/omok-D-2yRIOD.js",
  "./assets/janggi-CT6X0WUD.js",
  "./assets/sudoku-_eNxjhPf.js",
  "./assets/tetris-IkGoV9lf.js",
  "./assets/reversi-BOCCCuhM.js",
  "./assets/kkodle-B_oFsN6P.js",
  "./assets/minesweeper-BH22eowC.js",
  "./assets/nonogram-BUsWEat3.js",
  "./assets/DailyToggle-DPJA9RCX.js",
  "./assets/daily-CgpJmw-x.js",
  "./assets/solitaire-Dcv96EhT.js",
  "./assets/g2048-yTmL-IP5.js",
  "./assets/breakout-DX4cUpT3.js",
  "./assets/color-BAMIQH0K.js",
  "./assets/records-BtLfGmjf.js",
  "./assets/yut-fBPlGwo5.js",
  "./assets/stats-iehunl59.js",
  "./assets/useKeys-DRwSibvw.js",
  "./assets/react-CH_n-xEK.js",
  "./assets/progress-BMCkTN1T.js",
  "./assets/GameShell-BaCHcJtU.js",
  "./assets/sound-D6Q1XrNr.js",
  "./assets/pwa-D-iB9E7k.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, self.registration.scope).href)))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/* 화면 이동은 캐시 우선(오프라인 우선), 그 외 정적 파일도 캐시 우선 + 백그라운드 갱신 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) {
      /* 백그라운드에서 조용히 갱신 */
      fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); }).catch(() => {});
      return cached;
    }
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const fallback = await cache.match(new URL('./index.html', self.registration.scope).href);
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
