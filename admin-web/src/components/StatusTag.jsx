import { Tag } from 'antd';
// Created by AW-05. AW-04 must be merged after AW-05 (see the PR text).
import { labels } from '../constants/labels.js';

/**
 * Status chip with the text and color of `constants/labels.js`
 * (`labels[kind][value] = {text, color}`, docs/parts/admin-web.md §3).
 * A kind or value that is not in `labels` shows the raw value without a color.
 * @param {object} props
 * @param {string} props.kind field name in camelCase, e.g. 'missionStatus' (docs/04 §5)
 * @param {string} props.value the status value as the API sends it, e.g. 'completed'
 */
export function StatusTag({ kind, value }) {
  const label = labels[kind]?.[value];
  if (!label) return <Tag>{value}</Tag>;
  return <Tag color={label.color}>{label.text}</Tag>;
}
