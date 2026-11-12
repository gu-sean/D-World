/**
 * 앱 전체가 쓰는 색 값.
 *
 * 화면 코드에는 `#RRGGBB` 를 직접 쓰지 않고 여기서 가져다 쓴다.
 * 디자인 시안이 바뀌면 이 파일의 값만 고치면 앱 전체가 따라 바뀐다.
 */
export const colors = {
  /** 주요 동작(기본 버튼·선택된 탭·진행 막대) */
  primary: '#4F7CFF',
  /** 눌린 상태나 더 진한 강조가 필요할 때 */
  primaryDark: '#3A5FD9',
  /** 화면 바탕 */
  background: '#F7F8FA',
  /** 카드·입력칸처럼 바탕 위에 떠 있는 면 */
  surface: '#FFFFFF',
  /** 본문 글씨 */
  text: '#1F2430',
  /** 보조 설명 글씨 */
  textSub: '#6B7280',
  /** 구분선·테두리 */
  border: '#E5E7EB',
  /** 성공·완료 */
  success: '#22C55E',
  /** 주의·대기 */
  warning: '#F59E0B',
  /** 실패·삭제처럼 되돌리기 어려운 동작 */
  danger: '#EF4444',

  /** 목표 분야별 색. `categoryStyle.js`가 이 값을 찾아 쓴다. */
  category: {
    exercise: '#FF7A45',
    study: '#4F7CFF',
    lifestyle: '#22C55E',
  },
};

export default colors;
