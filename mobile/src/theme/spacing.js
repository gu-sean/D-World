/**
 * 여백 값.
 *
 * 화면 안의 모든 간격(padding·margin·gap)은 이 여섯 단계 중에서 고른다.
 * 숫자를 직접 적지 않으면 화면끼리 간격이 어긋나지 않는다.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/** 화면 좌우 기본 여백. 모든 화면이 같은 선에서 시작하도록 한다. */
export const screenPadding = spacing.lg;

export default spacing;
