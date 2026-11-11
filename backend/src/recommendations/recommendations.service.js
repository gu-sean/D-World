import { randomUUID } from 'node:crypto';
import { Dependencies, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app-exception.js';
import { conflict } from '../common/errors/http-errors.js';
import { kstDate } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';
import { AiClient, AiRequestError } from '../integrations/ai/ai.client.js';
import { DefinitionsService } from '../mission-definitions/definitions.service.js';
import { MissionsService } from '../missions/missions.service.js';
import {
  buildSituationRequest,
  MAX_CANDIDATES,
  pickFromAiResponse,
} from './situation-request.js';
import {
  isOutdoorSuitable,
  timeSlotOf,
  WeatherClient,
} from './weather.client.js';

export const RULE_RECOMMENDATION_VERSION = 'rule-rec@0.1.0';
const RATE_LIMIT_MINUTES = 10;
const EXPIRES_HOURS = 3;
const MAX_RECOMMENDATIONS = 3;
const SHORT_SECONDS = 900;

/** 추천 점수: 관심 분야, 이동 중/날씨에 맞는 운동, 밤에는 짧은 미션을 앞에 둔다 */
export function scoreDefinition(def, context) {
  const outdoor = def.exercise_code === 'running';
  if (outdoor && !context.outdoorSuitable) return null;
  let score = 0;
  if (def.interest) score += 3;
  if (outdoor && (context.isMoving || context.outdoorSuitable)) score += 2;
  if (!outdoor && context.isMoving) score -= 1;
  if (
    context.timeSlot === 'night' &&
    def.estimated_duration_seconds !== null &&
    def.estimated_duration_seconds <= SHORT_SECONDS
  ) {
    score += 2;
  }
  return score;
}

/** 추천 이유 문구 */
export function reasonFor(def, context) {
  if (def.exercise_code === 'running' && context.outdoorSuitable) {
    return '날씨가 좋아서 밖에서 달리기 좋아요.';
  }
  if (context.timeSlot === 'night') return '늦은 시간에도 가볍게 할 수 있어요.';
  if (def.interest) return '진행 중인 목표와 잘 맞아요.';
  return '오늘 해 보기 좋은 미션이에요.';
}

const gone = (code, status) => (message) =>
  new AppException(status, code, message);
const expired = gone('RECOMMENDATION_EXPIRED', HttpStatus.GONE);
const rateLimited = gone(
  'RECOMMENDATION_RATE_LIMITED',
  HttpStatus.TOO_MANY_REQUESTS,
);
const notFound = gone('not_found', HttpStatus.NOT_FOUND);

/**
 * 상황 추천 (08 A90~A93, 07 MissionRecommendation)
 * AI 서버(I04) 설정이 있으면 AI가 후보 중에서 고르고, 없거나 실패하면 규칙 기반 추천기로 대신한다.
 * 좌표는 날씨 조회에만 쓰고 저장하거나 로그에 남기지 않는다(parts/backend §6).
 */
@Injectable()
@Dependencies(
  DatabaseService,
  DefinitionsService,
  MissionsService,
  WeatherClient,
  AiClient,
)
export class RecommendationsService {
  logger = new Logger(RecommendationsService.name);

  constructor(database, definitions, missions, weather, ai) {
    this.ai = ai;
    this.database = database;
    this.definitions = definitions;
    this.missions = missions;
    this.weather = weather;
  }

  toView(row, definition) {
    return {
      id: row.id,
      rankNo: row.rank_no,
      title: row.suggestion_text ?? definition?.title ?? null,
      reason: row.reason,
      missionDefinition: definition ?? null,
      context: row.context,
      rewardPreview: definition?.rewardPreview ?? null,
      status: row.status,
      expiresAt: row.expires_at,
    };
  }

  async viewRows(rows) {
    const definitions = await this.definitions.viewsByIds(
      rows.map((row) => row.mission_definition_id).filter(Boolean),
    );
    const byId = new Map(definitions.map((d) => [d.id, d]));
    return rows.map((row) =>
      this.toView(row, byId.get(row.mission_definition_id)),
    );
  }

  async assertNotRateLimited(db, userId) {
    const { rows: recent } = await db.query(
      `SELECT 1 FROM ai_analysis_runs
        WHERE user_id = $1 AND run_type = 'situational_recommendation'
          AND requested_at > now() - make_interval(mins => $2)
        LIMIT 1`,
      [userId, RATE_LIMIT_MINUTES],
    );
    if (recent.length > 0) {
      throw rateLimited('추천은 10분에 한 번 받을 수 있어요.');
    }
  }

  /** 추천 후보: 공개 틀 중 최근 7일 안에 쓴 것을 뺀 최대 200개 */
  async loadCandidates(userId) {
    const { rows } = await this.database.query(
      `SELECT d.id, d.title, d.exercise_code, d.estimated_duration_seconds,
              c.code AS category_code,
              d.category_id IN (
                SELECT category_id FROM goals
                 WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL) AS interest
         FROM mission_definitions d
         JOIN goal_categories c ON c.id = d.category_id
        WHERE d.publication_status = 'public' AND d.deleted_at IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM missions m
                 WHERE m.user_id = $1 AND m.definition_id = d.id
                   AND m.deleted_at IS NULL AND m.status <> 'cancelled'
                   AND m.scheduled_date >= (now() AT TIME ZONE 'Asia/Seoul')::date - 7)
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT 200`,
      [userId],
    );
    return rows;
  }

  /** AI에 보내는 사용자 요약(07 SituationProfile): 최근 14일 기준 */
  async loadProfile(userId) {
    const [goals, recent, streak] = await Promise.all([
      this.database.query(
        `SELECT array_agg(DISTINCT c.code) AS codes, min(g.daily_available_minutes) AS minutes
           FROM goals g JOIN goal_categories c ON c.id = g.category_id
          WHERE g.user_id = $1 AND g.status = 'active' AND g.deleted_at IS NULL`,
        [userId],
      ),
      this.database.query(
        `SELECT count(*)::int AS planned,
                count(*) FILTER (WHERE status = 'completed')::int AS done,
                count(*) FILTER (WHERE status = 'completed' AND exercise_code IS NOT NULL)::int AS exercised
           FROM missions
          WHERE user_id = $1 AND deleted_at IS NULL AND status <> 'cancelled'
            AND scheduled_date BETWEEN (now() AT TIME ZONE 'Asia/Seoul')::date - 14
                                   AND (now() AT TIME ZONE 'Asia/Seoul')::date`,
        [userId],
      ),
      this.database.query(
        'SELECT current_success_days FROM streak_states WHERE user_id = $1',
        [userId],
      ),
    ]);
    const { planned, done, exercised } = recent.rows[0];
    return {
      activeGoalCategories: goals.rows[0].codes ?? [],
      recentCompletionRate:
        planned === 0 ? null : Number((done / planned).toFixed(4)),
      streakDays: streak.rows[0]?.current_success_days ?? 0,
      recentExerciseCount: exercised,
      availableMinutes: goals.rows[0].minutes ?? null,
    };
  }

  /** 규칙 기반 선택 (AI가 없거나 실패했을 때의 대체) */
  pickByRules(scored, context) {
    return scored.slice(0, MAX_RECOMMENDATIONS).map(({ def }) => ({
      def,
      reason: reasonFor(def, context),
    }));
  }

  /**
   * I04: POST /llm/situational-recommendations (동기, 15초)
   * 연결 실패·타임아웃·오류·형식 위반이면 null → 호출한 쪽이 규칙 기반으로 대체(A90)
   */
  async pickByAi({ kind, context, profile, shortlist }) {
    try {
      const response = await this.ai.post(
        '/llm/situational-recommendations',
        buildSituationRequest({
          kind,
          context,
          profile,
          candidates: shortlist,
          maxResults: MAX_RECOMMENDATIONS,
        }),
        { timeoutMs: this.ai.recommendTimeoutMs },
      );
      const picked = pickFromAiResponse(
        response.body,
        shortlist.slice(0, MAX_CANDIDATES),
        MAX_RECOMMENDATIONS,
      );
      if (!picked) {
        this.logger.warn('AI 추천 결과가 규칙에 맞지 않아 규칙 기반으로 대체');
        return null;
      }
      return { picked, engineVersion: response.body.engineVersion };
    } catch (error) {
      if (!(error instanceof AiRequestError)) throw error;
      this.logger.warn(
        `AI 추천 실패, 규칙 기반으로 대체: ${error.code ?? error.message}`,
      );
      return null;
    }
  }

  /**
   * A90: 사용자당 10분에 한 번, 1~3개 추천
   * 읽기 → (AI 호출은 트랜잭션 밖) → 저장 순서. 좌표는 날씨 조회에만 쓰고 저장하지 않는다.
   */
  async request(userId, input) {
    const context = await this.buildContext(input);
    await this.assertNotRateLimited(this.database, userId);

    const candidates = await this.loadCandidates(userId);
    const scored = candidates
      .map((def) => ({ def, score: scoreDefinition(def, context) }))
      .filter((entry) => entry.score !== null)
      .sort((a, b) => b.score - a.score);

    let picked = this.pickByRules(scored, context);
    let engineVersion = RULE_RECOMMENDATION_VERSION;
    if (this.ai.enabled && scored.length > 0) {
      const viaAi = await this.pickByAi({
        kind: input.kind,
        context,
        profile: await this.loadProfile(userId),
        shortlist: scored.slice(0, MAX_CANDIDATES).map(({ def }) => def),
      });
      if (viaAi) {
        picked = viaAi.picked.map(({ def, reason }) => ({
          def,
          reason: reason ?? reasonFor(def, context),
        }));
        engineVersion = viaAi.engineVersion ?? 'ai';
      }
    }

    return this.database
      .withTransaction(async (tx) => {
        await tx.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [
          userId,
        ]);
        // 읽은 뒤 동시에 다른 요청이 끼어들 수 있어 잠근 상태에서 다시 확인
        await this.assertNotRateLimited(tx, userId);

        const runId = randomUUID();
        await tx.query(
          `INSERT INTO ai_analysis_runs (id, user_id, run_type)
           VALUES ($1, $2, 'situational_recommendation')`,
          [runId, userId],
        );
        const rows = [];
        for (const [index, { def, reason }] of picked.entries()) {
          const { rows: made } = await tx.query(
            `INSERT INTO ai_mission_recommendations
                  (id, run_id, user_id, rank_no, mission_definition_id, reason,
                   context, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb,
                   now() + make_interval(hours => $8))
           RETURNING id, rank_no, mission_definition_id, suggestion_text, reason,
                     context, status, expires_at`,
            [
              randomUUID(),
              runId,
              userId,
              index + 1,
              def.id,
              reason,
              JSON.stringify(context),
              EXPIRES_HOURS,
            ],
          );
          rows.push(made[0]);
        }
        // 결과는 열린(requested) 실행에만 붙일 수 있으므로 다 넣은 뒤 실행을 완료한다
        await tx.query(
          `UPDATE ai_analysis_runs
              SET status = 'completed', engine_version = $2, completed_at = now()
            WHERE id = $1`,
          [runId, engineVersion],
        );
        return rows;
      })
      .then((rows) => this.viewRows(rows));
  }

  /** 입력(좌표 포함) → 저장해도 되는 상황 정보. 좌표는 여기서 버린다 */
  async buildContext({ kind, latitude, longitude, isMoving }) {
    const weather =
      kind === 'moving'
        ? null
        : await this.weather.current({ latitude, longitude });
    const context = {
      weather: weather?.weather ?? null,
      temperatureC: weather?.temperatureC ?? null,
      timeSlot: timeSlotOf(),
      isMoving: kind === 'moving' ? isMoving !== false : Boolean(isMoving),
    };
    return { ...context, outdoorSuitable: isOutdoorSuitable(context) };
  }

  /** A93: 아직 살아 있는(shown, 기한 전) 추천 */
  async active(userId) {
    const { rows } = await this.database.query(
      `SELECT id, rank_no, mission_definition_id, suggestion_text, reason,
              context, status, expires_at
         FROM ai_mission_recommendations
        WHERE user_id = $1 AND status = 'shown'
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC, rank_no`,
      [userId],
    );
    return this.viewRows(rows);
  }

  async lock(tx, userId, id) {
    const { rows } = await tx.query(
      `SELECT id, run_id, status, mission_definition_id,
              (expires_at IS NOT NULL AND expires_at <= now()) AS lapsed
         FROM ai_mission_recommendations
        WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, userId],
    );
    if (!rows[0]) throw notFound('추천을 찾을 수 없음');
    return rows[0];
  }

  /** A91: 오늘 날짜 미션을 만들고 같은 실행의 나머지 추천은 닫는다 */
  async accept(userId, id) {
    const rec = await this.database.withTransaction(async (tx) => {
      const found = await this.lock(tx, userId, id);
      if (found.status !== 'shown') {
        throw conflict('RECOMMENDATION_NOT_OPEN', '이미 처리한 추천');
      }
      if (found.lapsed) throw expired('추천 시간이 지났어요.');
      return found;
    });
    if (!rec.mission_definition_id) {
      throw conflict('RECOMMENDATION_NOT_OPEN', '미션으로 만들 수 없는 추천');
    }

    const [mission] = await this.missions.createMissions(userId, {
      definitionId: rec.mission_definition_id,
      scheduledDates: [kstDate()],
    });
    // DB 트리거가 결정 뒤에는 status·decided_at만 바꾸게 하므로 mission_id는 기록하지 않는다
    await this.database.query(
      `UPDATE ai_mission_recommendations
          SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'dismissed' END,
              decided_at = now()
        WHERE run_id = $2 AND user_id = $3 AND status = 'shown'`,
      [id, rec.run_id, userId],
    );
    await this.missions.attachChallengeIds(mission);
    return mission;
  }

  /** A92: 본문 없이 닫기 */
  async dismiss(userId, id) {
    await this.database.withTransaction(async (tx) => {
      const found = await this.lock(tx, userId, id);
      if (found.status === 'dismissed') return;
      if (found.status !== 'shown') {
        throw conflict('RECOMMENDATION_NOT_OPEN', '이미 처리한 추천');
      }
      await tx.query(
        `UPDATE ai_mission_recommendations
            SET status = 'dismissed', decided_at = now() WHERE id = $1`,
        [id],
      );
    });
  }
}
