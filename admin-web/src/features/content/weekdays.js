// 추천 문구의 요일: 1=월 … 7=일(한국 요일)
import { t } from '../../i18n/index.js';

export const WEEKDAYS = [
  { value: 1, label: t('월요일') },
  { value: 2, label: t('화요일') },
  { value: 3, label: t('수요일') },
  { value: 4, label: t('목요일') },
  { value: 5, label: t('금요일') },
  { value: 6, label: t('토요일') },
  { value: 7, label: t('일요일') },
];

/** 목록·양식에 보여 줄 이름 */
export const weekdayLabel = (weekday) =>
  WEEKDAYS.find((day) => day.value === weekday)?.label ?? '-';
