import { describe, it, expect } from 'vitest';
import { HangulComposer, compose, decompose, toJamos } from '../src/games/kkodle/hangul';
import { WORDS } from '../src/games/kkodle/words';
import { mergeKeyStates, scoreGuess, toSlots, validateGuess } from '../src/games/kkodle/engine';

describe('한글 분해·조합', () => {
  it('완성형 글자를 초·중·종성으로 나눈다', () => {
    expect(decompose('사')).toEqual({ cho: 'ㅅ', jung: 'ㅏ', jong: '' });
    expect(decompose('값')).toEqual({ cho: 'ㄱ', jung: 'ㅏ', jong: 'ㅄ' });
    expect(decompose('과')).toEqual({ cho: 'ㄱ', jung: 'ㅘ', jong: '' });
    expect(decompose('A')).toBeNull();
  });

  it('나눈 자모를 다시 합치면 원래 글자', () => {
    for (const w of WORDS.slice(0, 50)) {
      const rebuilt = toJamos(w).map((j) => compose(j.cho, j.jung, j.jong)).join('');
      expect(rebuilt).toBe(w);
    }
  });
});

describe('한글 입력 조합기', () => {
  const type = (jamos: string[], max = 2) => {
    const c = new HangulComposer(max);
    jamos.forEach((j) => c.push(j));
    return c;
  };

  it('초성+중성으로 글자를 만든다', () => {
    expect(type(['ㅅ', 'ㅏ']).text()).toBe('사');
  });

  it('받침을 붙인다', () => {
    expect(type(['ㄱ', 'ㅏ', 'ㅁ']).text()).toBe('감');
  });

  it('복모음을 합친다', () => {
    expect(type(['ㄱ', 'ㅗ', 'ㅏ']).text()).toBe('과');
    expect(type(['ㅇ', 'ㅜ', 'ㅣ']).text()).toBe('위');
  });

  it('겹받침을 만든다', () => {
    expect(type(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ']).text()).toBe('값');
  });

  it('받침 뒤에 모음이 오면 다음 글자로 넘어간다', () => {
    expect(type(['ㄱ', 'ㅏ', 'ㄴ', 'ㅏ']).text()).toBe('가나');
    /* 겹받침은 뒷자음만 넘어간다 */
    expect(type(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ', 'ㅣ']).text()).toBe('갑시');
  });

  it('두 글자를 채우면 더 받지 않는다', () => {
    const c = type(['ㅅ', 'ㅏ', 'ㄱ', 'ㅘ']);
    expect(c.text()).toBe('사과');
    c.push('ㄴ');
    c.push('ㅏ');
    expect(c.text()).toBe('사과');
  });

  it('받침은 두 글자가 다 차 있어도 붙는다', () => {
    const c = type(['ㅁ', 'ㅏ', 'ㄷ', 'ㅏ']);
    expect(c.text()).toBe('마다');
    c.push('ㅇ');
    expect(c.text()).toBe('마당');
  });

  it('지우기는 자모 하나씩 되돌린다', () => {
    const c = type(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ']);
    expect(c.text()).toBe('값');
    c.backspace();
    expect(c.text()).toBe('갑');
    c.backspace();
    expect(c.text()).toBe('가');
    c.backspace();
    expect(c.text()).toBe('ㄱ');
    c.backspace();
    expect(c.text()).toBe('');
    c.backspace();
    expect(c.text()).toBe('');
  });

  it('확정된 글자도 자모 단위로 지운다', () => {
    const c = type(['ㅅ', 'ㅏ', 'ㄱ', 'ㅗ', 'ㅏ']);
    expect(c.text()).toBe('사과');
    c.backspace();
    expect(c.text()).toBe('사고');
    c.backspace();
    expect(c.text()).toBe('사ㄱ');
  });
});

describe('꼬들 채점', () => {
  it('여섯 칸으로 펼친다', () => {
    expect(toSlots('사과')).toEqual(['ㅅ', 'ㅏ', '', 'ㄱ', 'ㅘ', '']);
    expect(toSlots('감자')).toEqual(['ㄱ', 'ㅏ', 'ㅁ', 'ㅈ', 'ㅏ', '']);
  });

  it('정답을 맞히면 모두 hit', () => {
    const r = scoreGuess('사과', '사과');
    expect(r.map((x) => x.state)).toEqual(['hit', 'hit', 'empty', 'hit', 'hit', 'empty']);
  });

  it('자리가 다르면 present', () => {
    /* 감자 vs 자감: ㄱ,ㅏ,ㅁ,ㅈ,ㅏ,'' vs ㅈ,ㅏ,'',ㄱ,ㅏ,ㅁ */
    const r = scoreGuess('감자', '자감');
    expect(r[0].state).toBe('present'); // ㄱ
    expect(r[1].state).toBe('hit');     // ㅏ 자리 일치
    expect(r[2].state).toBe('present'); // ㅁ
    expect(r[3].state).toBe('present'); // ㅈ
    expect(r[4].state).toBe('hit');     // ㅏ
  });

  it('없는 자모는 miss', () => {
    const r = scoreGuess('구름', '사과');
    expect(r.filter((x) => x.state === 'miss').length).toBeGreaterThan(0);
    expect(r.every((x) => x.state !== 'hit')).toBe(true);
  });

  it('같은 자모가 정답보다 많으면 남는 것은 miss', () => {
    /* 정답 '사과'에는 ㅅ이 하나 — 추측에 ㅅ이 둘이면 하나만 표시된다 */
    const r = scoreGuess('소식', '사과');
    const sCount = r.filter((x) => x.jamo === 'ㅅ' && x.state !== 'miss').length;
    expect(sCount).toBeLessThanOrEqual(1);
  });

  it('빈 종성 칸은 채점에서 빠진다', () => {
    const r = scoreGuess('사과', '감자');
    expect(r[2].state).toBe('empty');
    expect(r[5].state).toBe('empty');
  });

  it('자판 상태는 더 좋은 결과로만 올라간다', () => {
    let keys: Record<string, ReturnType<typeof scoreGuess>[number]['state']> = {};
    keys = mergeKeyStates(keys, scoreGuess('감자', '자감'));
    expect(keys['ㅏ']).toBe('hit');
    keys = mergeKeyStates(keys, scoreGuess('구름', '자감'));
    expect(keys['ㅏ']).toBe('hit'); // 내려가지 않는다
    expect(keys['ㄹ']).toBe('miss');
  });
});

describe('입력 검사', () => {
  it('두 글자가 아니면 거절', () => {
    expect(validateGuess('사')).toBe('length');
    expect(validateGuess('사과나')).toBe('length');
  });
  it('사전에 없으면 거절', () => {
    expect(validateGuess('쓰쓰')).toBe('unknown');
  });
  it('사전에 있으면 통과', () => {
    expect(validateGuess('사과')).toBeNull();
  });
});

describe('낱말 사전', () => {
  it('모두 두 글자 한글', () => {
    for (const w of WORDS) {
      expect([...w]).toHaveLength(2);
      expect(/^[가-힣]{2}$/.test(w)).toBe(true);
    }
  });
  it('중복이 없다', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
  it('충분한 수가 있다', () => {
    expect(WORDS.length).toBeGreaterThan(300);
  });
});
