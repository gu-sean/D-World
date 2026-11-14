import { BadRequestException, Dependencies, Injectable } from '@nestjs/common';
import { from, mergeMap } from 'rxjs';
import { DatabaseService } from '../../database/database.service.js';

// 분야·난이도는 환경마다 ID가 다르므로 API에서는 code로 주고받음 (팀 문서 03 §7)
//   요청: categoryCode / difficultyCode → 서비스 안쪽에서 쓰는 categoryId / difficultyId (ID)
//   응답: categoryId / difficultyId (ID) → categoryCode / difficultyCode
//        (관리자 API는 화면의 폼·필터가 ID를 쓰므로 categoryId / difficultyId도 함께 유지)
const PAIRS = [
  { code: 'categoryCode', id: 'categoryId', table: 'goal_categories' },
  { code: 'difficultyCode', id: 'difficultyId', table: 'difficulty_levels' },
];
const CACHE_MS = 5000;

/**
 * 전역 인터셉터: 앱·관리자 API의 요청/응답에서 분야·난이도 code ↔ ID를 바꿈
 * 내부 호출(/internal/)은 제외. 서비스·검증 코드는 ID 기준 그대로 둠
 */
@Injectable()
@Dependencies(DatabaseService)
export class CatalogCodeInterceptor {
  constructor(database) {
    this.database = database;
    this.maps = new Map(); // table → { at, idToCode, codeToId }
  }

  async mapFor(table, force = false) {
    const cached = this.maps.get(table);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached;
    const { rows } = await this.database.query(`SELECT id, code FROM ${table}`);
    const entry = {
      at: Date.now(),
      idToCode: new Map(rows.map((row) => [row.id, row.code])),
      codeToId: new Map(rows.map((row) => [row.code, row.id])),
    };
    this.maps.set(table, entry);
    return entry;
  }

  intercept(context, next) {
    const request = context.switchToHttp().getRequest();
    const path = request.originalUrl ?? request.url ?? '';
    if (path.startsWith('/internal/')) return next.handle();
    return from(this.toInternal(request)).pipe(
      mergeMap(() => next.handle()),
      mergeMap((body) =>
        from(this.toExternal(body, path.startsWith('/admin/'))),
      ),
    );
  }

  async toInternal(request) {
    if (
      hasKey(
        request.body,
        PAIRS.map((p) => p.code),
      )
    ) {
      request.body = await this.walk(request.body, 'in');
    }
    if (
      hasKey(
        request.query,
        PAIRS.map((p) => p.code),
      )
    ) {
      // Express 5의 req.query는 getter라 값을 덮어써서 교체
      Object.defineProperty(request, 'query', {
        value: await this.walk(request.query, 'in'),
        configurable: true,
        writable: true,
      });
    }
  }

  async toExternal(body, keepIds = false) {
    if (
      !hasKey(
        body,
        PAIRS.map((p) => p.id),
      )
    )
      return body;
    return this.walk(body, 'out', keepIds);
  }

  async walk(value, direction, keepIds = false) {
    if (Array.isArray(value)) {
      return Promise.all(
        value.map((item) => this.walk(item, direction, keepIds)),
      );
    }
    if (!value || typeof value !== 'object' || value instanceof Date) {
      return value;
    }
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      const pair = PAIRS.find((p) =>
        direction === 'in' ? p.code === key : p.id === key,
      );
      // 응답에서 값이 없는 categoryId: null도 categoryCode: null로 맞춤 (키가 값 유무에 따라 달라지지 않게)
      if (pair && item === null && direction === 'out') {
        result[pair.code] = null;
        if (keepIds) result[pair.id] = null;
        continue;
      }
      if (!pair || typeof item !== 'string') {
        result[key] = await this.walk(item, direction, keepIds);
        continue;
      }
      if (direction === 'in') {
        result[pair.id] = await this.codeToId(pair, item);
      } else {
        result[pair.code] = await this.idToCode(pair, item);
        if (keepIds) result[pair.id] = item;
      }
    }
    return result;
  }

  async codeToId(pair, code) {
    let id = (await this.mapFor(pair.table)).codeToId.get(code);
    if (!id) id = (await this.mapFor(pair.table, true)).codeToId.get(code);
    if (!id) {
      throw new BadRequestException([`${pair.code}: 알 수 없는 코드`]);
    }
    return id;
  }

  async idToCode(pair, id) {
    let code = (await this.mapFor(pair.table)).idToCode.get(id);
    if (!code) code = (await this.mapFor(pair.table, true)).idToCode.get(id);
    return code ?? id;
  }
}

/** 값 안(중첩 포함)에 대상 키가 하나라도 있는지, 없으면 변환·조회를 건너뜀 */
function hasKey(value, keys) {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, keys));
  if (!value || typeof value !== 'object' || value instanceof Date) {
    return false;
  }
  return Object.entries(value).some(
    ([key, item]) => keys.includes(key) || hasKey(item, keys),
  );
}
