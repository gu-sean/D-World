/**
 * 목표 분야 코드로 색과 아이콘을 찾는다.
 *
 * 분야의 **이름은 서버가 준 값**(`GoalCategory.name`)을 그대로 쓰고,
 * 여기서는 보이는 모양만 정한다. 서버에 새 분야가 생겨도 앱이 멈추지 않도록
 * 모르는 코드는 회색 기본값으로 돌려준다.
 */
import colors from './colors';

const STYLES = {
  exercise: { color: colors.category.exercise, icon: 'run' },
};

const FALLBACK = { color: colors.textSub, icon: 'dot' };

/**
 * @param {string|null|undefined} categoryCode 서버가 준 분야 코드
 * @returns {{color: string, icon: string, tint: string}}
 *          `tint`는 칩·배경에 쓰는 옅은 색
 */
export function categoryStyle(categoryCode) {
  const found = STYLES[categoryCode] ?? FALLBACK;
  return { ...found, tint: `${found.color}1A` };
}

export default categoryStyle;
