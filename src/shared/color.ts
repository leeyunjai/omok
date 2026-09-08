/** 색 다루기 — 그러데이션이나 입체감을 줄 때 쓴다. */

/**
 * #rrggbb 를 밝게(amount > 0) 또는 어둡게(amount < 0) 만든다.
 * amount는 -1 ~ 1. 밝게 할 때는 흰색 쪽으로, 어둡게 할 때는 검은색 쪽으로 그만큼 간다.
 */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)))
  );
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

/** #rrggbb + 투명도 → rgba() */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
