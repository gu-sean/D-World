import { BadRequestException } from '@nestjs/common';

// 관리자 목록 공통 규칙 (팀 문서 09 §0-7): ?page=1&size=20(최대 100), sort는 API별 허용 값만
const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;

const toInt = (raw, name, min, max, fallback) => {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException([`${name}: ${min}~${max} 정수여야 함`]);
  }
  return value;
};

/**
 * page·size·sort 파싱
 * sorts: { 'submittedAt,asc': 'r.submitted_at ASC, r.id ASC' } (허용 목록이 곧 SQL 조각이라 주입 불가)
 * 첫 항목이 기본 정렬
 */
export function parseAdminPage(query, sorts) {
  const page = toInt(query.page, 'page', 1, 1_000_000, 1);
  const size = toInt(query.size, 'size', 1, MAX_SIZE, DEFAULT_SIZE);
  const sortKey = query.sort ?? Object.keys(sorts)[0];
  if (!Object.hasOwn(sorts, sortKey)) {
    throw new BadRequestException([
      `sort: ${Object.keys(sorts).join(' | ')} 중 하나여야 함`,
    ]);
  }
  return { page, size, offset: (page - 1) * size, orderBy: sorts[sortKey] };
}

/** AdminPage<T> 응답 */
export const adminPage = (items, { page, size }, totalCount) => ({
  items,
  page,
  size,
  totalCount: Number(totalCount),
});

/** 쿼리 값 하나를 허용 목록에서 고름(없으면 undefined) */
export function pickEnum(query, name, allowed) {
  const raw = query[name];
  if (raw === undefined || raw === '') return undefined;
  if (!allowed.includes(raw)) {
    throw new BadRequestException([
      `${name}: ${allowed.join(' | ')} 중 하나여야 함`,
    ]);
  }
  return raw;
}
