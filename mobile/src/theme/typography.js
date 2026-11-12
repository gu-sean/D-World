/**
 * 글자 크기·굵기 묶음.
 *
 * `<Text style={typography.body}>` 처럼 통째로 넘겨서 쓴다.
 * 색은 따로 지정한다 — 같은 크기라도 본문 색과 보조 색을 섞어 쓰기 때문이다.
 */
export const typography = {
  /** 화면 제목 */
  title: { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  /** 구역 제목·카드 제목 */
  subtitle: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  /** 본문 */
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  /** 본문 중 강조 */
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  /** 설명·날짜·단위처럼 작은 글씨 */
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 18 },
  /** 숫자를 크게 보여 줄 때 (포인트·거리·시간) */
  figure: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
};

export default typography;
