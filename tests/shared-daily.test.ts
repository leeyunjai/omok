import { describe, it, expect, beforeEach } from 'vitest';
import { dailyIndex, daysBetween, hashDate, todayKey } from '../src/shared/daily';

/* localStorage가 없는 node 환경이라 순수 함수만 검증한다 */
describe('daily 유틸', () => {
  beforeEach(() => { /* no-op */ });

  it('같은 날짜·게임이면 항상 같은 문제 번호', () => {
    const a = dailyIndex('kkodle', 500, '2026-09-08');
    const b = dailyIndex('kkodle', 500, '2026-09-08');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(500);
  });

  it('날짜가 다르면 대체로 다른 문제', () => {
    const days = ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'];
    const idx = days.map((d) => dailyIndex('kkodle', 500, d));
    expect(new Set(idx).size).toBeGreaterThan(1);
  });

  it('게임이 다르면 다른 문제를 뽑는다', () => {
    expect(hashDate('2026-09-08', 'a')).not.toBe(hashDate('2026-09-08', 'b'));
  });

  it('풀 크기를 넘지 않는다', () => {
    for (let i = 1; i <= 40; i++) {
      const n = dailyIndex('x', i, `2026-09-${String(i).padStart(2, '0')}`);
      expect(n).toBeLessThan(i);
    }
  });

  it('daysBetween은 달을 넘겨도 맞는다', () => {
    expect(daysBetween('2026-09-08', '2026-09-09')).toBe(1);
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-09-10', '2026-09-08')).toBe(-2);
  });

  it('todayKey는 YYYY-MM-DD 형식', () => {
    expect(todayKey(new Date(2026, 8, 8))).toBe('2026-09-08');
    expect(todayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('시드 난수', () => {
  it('같은 시드는 같은 수열을 낸다', async () => {
    const { seededRandom, dailyRandom } = await import('../src/shared/daily');
    const a = seededRandom(12345);
    const b = seededRandom(12345);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(1);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);

    /* 날짜가 다르면 다른 수열 */
    const d1 = dailyRandom('x', '2026-09-08')();
    const d2 = dailyRandom('x', '2026-09-09')();
    expect(d1).not.toBe(d2);
  });
});
