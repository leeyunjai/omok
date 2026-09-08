import { DailyRecord, activeStreak } from '../daily';

interface Props {
  mode: 'daily' | 'free';
  onChange: (mode: 'daily' | 'free') => void;
  record: DailyRecord;
  /** 오늘 문제를 이미 끝냈는지 */
  doneToday: boolean;
  /** 자유 모드에서 오른쪽에 보여줄 내용 */
  freeInfo?: React.ReactNode;
}

/**
 * 데일리가 있는 게임들이 함께 쓰는 모드 전환 줄.
 * 꼬들·스도쿠·노노그램·지뢰찾기가 같은 모양을 쓴다.
 */
export function DailyToggle({ mode, onChange, record, doneToday, freeInfo }: Props) {
  const streak = activeStreak(record);
  return (
    <div className="daily-bar">
      <div className="daily-modes">
        <button aria-pressed={mode === 'daily'} onClick={() => onChange('daily')}>
          오늘의 문제{doneToday ? ' ✓' : ''}
        </button>
        <button aria-pressed={mode === 'free'} onClick={() => onChange('free')}>자유</button>
      </div>
      <div className="daily-streak">
        {mode === 'daily' ? (
          <>
            <span>연속 <strong>{streak}</strong>일</span>
            <span>최고 <strong>{record.bestStreak}</strong>일</span>
          </>
        ) : (
          freeInfo
        )}
      </div>
    </div>
  );
}
