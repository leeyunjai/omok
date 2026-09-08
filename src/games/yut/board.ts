/** 윷판 좌표 — 바깥 20칸 + 지름길 8칸 + 중앙, 모두 29자리 */
export const VIEW = 340;
const M = 34;
const S = VIEW - M * 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface NodePos { id: string; x: number; y: number; corner?: boolean; center?: boolean }

function build(): Record<string, NodePos> {
  const pos: Record<string, NodePos> = {};
  const TR: [number, number] = [M + S, M];
  const TL: [number, number] = [M, M];
  const BL: [number, number] = [M, M + S];
  const BR: [number, number] = [M + S, M + S];

  const set = (id: string, x: number, y: number, extra: Partial<NodePos> = {}) => {
    pos[id] = { id, x, y, ...extra };
  };

  /* 참먹이(출발·도착) 모서리 */
  set('o19', BR[0], BR[1], { corner: true });
  /* 오른쪽 변을 따라 위로 */
  for (let i = 0; i < 4; i++) {
    set(`o${i}`, BR[0], lerp(BR[1], TR[1], (i + 1) / 5));
  }
  set('o4', TR[0], TR[1], { corner: true });
  /* 위쪽 변을 따라 왼쪽으로 */
  for (let i = 0; i < 4; i++) {
    set(`o${5 + i}`, lerp(TR[0], TL[0], (i + 1) / 5), TR[1]);
  }
  set('o9', TL[0], TL[1], { corner: true });
  /* 왼쪽 변을 따라 아래로 */
  for (let i = 0; i < 4; i++) {
    set(`o${10 + i}`, TL[0], lerp(TL[1], BL[1], (i + 1) / 5));
  }
  set('o14', BL[0], BL[1], { corner: true });
  /* 아래쪽 변을 따라 오른쪽으로 */
  for (let i = 0; i < 4; i++) {
    set(`o${15 + i}`, lerp(BL[0], BR[0], (i + 1) / 5), BL[1]);
  }

  const cx = M + S / 2;
  const cy = M + S / 2;
  set('center', cx, cy, { center: true });

  /* 지름길: o4 → 중앙 → o14, o9 → 중앙 → o19 */
  set('a1', lerp(TR[0], cx, 1 / 3), lerp(TR[1], cy, 1 / 3));
  set('a2', lerp(TR[0], cx, 2 / 3), lerp(TR[1], cy, 2 / 3));
  set('b1', lerp(cx, BL[0], 1 / 3), lerp(cy, BL[1], 1 / 3));
  set('b2', lerp(cx, BL[0], 2 / 3), lerp(cy, BL[1], 2 / 3));
  set('c1', lerp(TL[0], cx, 1 / 3), lerp(TL[1], cy, 1 / 3));
  set('c2', lerp(TL[0], cx, 2 / 3), lerp(TL[1], cy, 2 / 3));
  set('d1', lerp(cx, BR[0], 1 / 3), lerp(cy, BR[1], 1 / 3));
  set('d2', lerp(cx, BR[0], 2 / 3), lerp(cy, BR[1], 2 / 3));

  return pos;
}

export const NODES = build();

/** 판 바깥으로 조금 여유를 둔 그리기 영역 — 참먹이 밖의 '나기' 자리를 그린다 */
export const PAD = 16;
export const VIEW_BOX = `${-PAD} ${-PAD} ${VIEW + PAD * 2} ${VIEW + PAD * 2}`;

/** 말이 판을 벗어나 나가는 자리. 참먹이(o19) 바깥쪽 대각선으로 뺀다 */
export const EXIT = { x: NODES.o19.x + 27, y: NODES.o19.y + 27 };
export const NODE_LIST = Object.values(NODES);

/** 바깥 길 순서대로 이어 그리기 위한 좌표 목록 */
export const OUTER_RING = [
  'o19', 'o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8',
  'o9', 'o10', 'o11', 'o12', 'o13', 'o14', 'o15', 'o16', 'o17', 'o18',
].map((id) => NODES[id]);
