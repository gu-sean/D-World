import { t } from '../../../i18n/index.js';
// Labels of values that have no entry in src/constants/labels.js (status tags use <StatusTag>).
export const METHOD_LABEL = { camera: t('카메라'), sensor: t('센서') };

/** @param {number|null|undefined} value 0~1 */
export const formatConfidence = (value) => (value == null ? '-' : `${Math.round(value * 100)}%`);

/** @param {{targetValue?: number|null, targetUnit?: string|null}} mission */
export const formatTarget = (mission) =>
  mission.targetValue == null ? '-' : `${mission.targetValue}${mission.targetUnit ?? ''}`;
