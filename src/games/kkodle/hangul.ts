/**
 * 한글 자모 분해 · 조합 · 입력 오토마타.
 * IME가 없는 환경(설치형 앱, 데스크톱 브라우저)에서도 화면 자판만으로 한글을 입력하기 위해
 * 직접 조합기를 구현한다.
 */

export const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

export const JUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const;

export const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const;

const BASE = 0xac00;
const LAST = 0xd7a3;

/** 겹받침 조합: 앞 받침 + 새 자음 → 겹받침 */
const JONG_COMBINE: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ',
  'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
  'ㅂㅅ': 'ㅄ',
};
/** 겹받침 분해: 겹받침 → [남는 받침, 다음 글자 초성] */
const JONG_SPLIT: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(JONG_COMBINE).map(([pair, combined]) => [combined, [pair[0], pair[1]] as [string, string]])
);

/** 복모음 조합: 앞 모음 + 새 모음 → 복모음 */
const JUNG_COMBINE: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
  'ㅡㅣ': 'ㅢ',
};
const JUNG_SPLIT: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(JUNG_COMBINE).map(([pair, combined]) => [combined, [pair[0], pair[1]] as [string, string]])
);

export const isConsonant = (j: string) => (CHO as readonly string[]).includes(j) || (JONG as readonly string[]).includes(j);
export const isVowel = (j: string) => (JUNG as readonly string[]).includes(j);

export function isSyllable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= BASE && code <= LAST;
}

export interface Jamo {
  cho: string;
  jung: string;
  jong: string;
}

/** 완성형 글자 하나를 초·중·종성으로 나눈다 */
export function decompose(ch: string): Jamo | null {
  if (!isSyllable(ch)) return null;
  const code = (ch.codePointAt(0) ?? 0) - BASE;
  return {
    cho: CHO[Math.floor(code / 588)],
    jung: JUNG[Math.floor((code % 588) / 28)],
    jong: JONG[code % 28],
  };
}

/** 초·중·종성을 완성형 글자로 합친다 */
export function compose(cho: string, jung: string, jong = ''): string {
  const ci = CHO.indexOf(cho as typeof CHO[number]);
  const vi = JUNG.indexOf(jung as typeof JUNG[number]);
  const ti = JONG.indexOf(jong as typeof JONG[number]);
  if (ci < 0 || vi < 0 || ti < 0) return '';
  return String.fromCodePoint(BASE + ci * 588 + vi * 28 + ti);
}

/** 낱말을 자모 배열로 (종성이 없으면 빈 문자열) */
export function toJamos(word: string): Jamo[] {
  return [...word].map((ch) => decompose(ch)).filter((j): j is Jamo => j !== null);
}

/**
 * 화면 자판 입력 조합기.
 * 확정된 글자들(committed)과 조합 중인 글자(cho/jung/jong)를 들고 있다가
 * 자모가 들어올 때마다 한글 입력기와 같은 규칙으로 이어 붙인다.
 */
export class HangulComposer {
  private committed: string[] = [];
  private cho = '';
  private jung = '';
  private jong = '';

  constructor(private maxSyllables = Infinity) {}

  /** 화면에 보여줄 현재 문자열 */
  text(): string {
    return this.committed.join('') + this.composing();
  }

  /** 글자 수 (조합 중인 글자 포함) */
  length(): number {
    return this.committed.length + (this.composing() ? 1 : 0);
  }

  private composing(): string {
    if (!this.cho && !this.jung) return '';
    if (this.cho && !this.jung) return this.cho;
    if (!this.cho && this.jung) return this.jung;
    return compose(this.cho, this.jung, this.jong);
  }

  private commit() {
    const c = this.composing();
    if (c) this.committed.push(c);
    this.cho = this.jung = this.jong = '';
  }

  private full(): boolean {
    return this.length() >= this.maxSyllables;
  }

  clear() {
    this.committed = [];
    this.cho = this.jung = this.jong = '';
  }

  /** 자모 한 개 입력 */
  push(jamo: string): void {
    if (isVowel(jamo)) return this.pushVowel(jamo);
    if (isConsonant(jamo)) return this.pushConsonant(jamo);
  }

  private pushConsonant(c: string) {
    /* 초성 자리가 비었으면 초성으로 */
    if (!this.cho && !this.jung) {
      if (this.full()) return;
      this.cho = c;
      return;
    }
    /* 초성만 있는 상태에서 자음이 또 오면 앞 글자를 확정하고 새로 시작 */
    if (this.cho && !this.jung) {
      this.commit();
      if (this.full()) return;
      this.cho = c;
      return;
    }
    /* 받침 자리에 넣을 수 있으면 받침으로 */
    if (!this.jong && (JONG as readonly string[]).includes(c)) {
      this.jong = c;
      return;
    }
    /* 겹받침으로 이어지면 겹받침으로 */
    const combined = JONG_COMBINE[this.jong + c];
    if (this.jong && combined) {
      this.jong = combined;
      return;
    }
    this.commit();
    if (this.full()) return;
    this.cho = c;
  }

  private pushVowel(v: string) {
    /* 초성 없이 모음만 온 경우 */
    if (!this.cho && !this.jung) {
      if (this.full()) return;
      this.jung = v;
      return;
    }
    /* 초성만 있으면 중성으로 */
    if (this.cho && !this.jung) {
      this.jung = v;
      return;
    }
    /* 받침이 있으면 받침을 다음 글자의 초성으로 넘긴다 (예: 간 + ㅏ → 가나) */
    if (this.jong) {
      const split = JONG_SPLIT[this.jong];
      let moved: string;
      if (split) {
        this.jong = split[0];
        moved = split[1];
      } else {
        moved = this.jong;
        this.jong = '';
      }
      this.commit();
      if (this.full()) return;
      this.cho = moved;
      this.jung = v;
      return;
    }
    /* 복모음으로 이어지면 합친다 */
    const combined = JUNG_COMBINE[this.jung + v];
    if (combined) {
      this.jung = combined;
      return;
    }
    this.commit();
    if (this.full()) return;
    this.jung = v;
  }

  /** 자모 한 개 지우기 */
  backspace(): void {
    if (this.jong) {
      const split = JONG_SPLIT[this.jong];
      this.jong = split ? split[0] : '';
      return;
    }
    if (this.jung) {
      const split = JUNG_SPLIT[this.jung];
      this.jung = split ? split[0] : '';
      return;
    }
    if (this.cho) {
      this.cho = '';
      return;
    }
    /* 조합 중인 글자가 없으면 확정된 마지막 글자를 다시 분해해 한 자모만 뺀다 */
    const last = this.committed.pop();
    if (!last) return;
    const j = decompose(last);
    if (!j) return;
    this.cho = j.cho;
    this.jung = j.jung;
    this.jong = j.jong;
    this.backspace();
  }
}
