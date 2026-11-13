import { newId } from '../../src/common/ids.js';
import { kstDate } from '../../src/common/time/kst.js';
import { createTestApp } from '../support/app.js';
import { createUser as createUserWith } from '../support/users.js';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)(
  '모바일 리포트·달력 API A60~A64 (PostgreSQL)',
  () => {
    let app;
    let db;
    let http;

    const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

    beforeAll(async () => {
      ({ app, http, db } = await createTestApp());
    });

    afterAll(() => app.close());

    it('A60 데이터가 없어도 0으로 채워진 요약을 돌려줌', async () => {
      const user = await createUserWith(app, db);
      const res = await http
        .get('/api/v1/reports/summary?period=week')
        .set(auth(user))
        .expect(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          period: 'week',
          categoryCode: null,
          completedMissionCount: 0,
          plannedMissionCount: 0,
          goalProgressRate: 0,
          achievementRate: 0,
          streakDays: 0,
          categories: [],
          insight: null,
          nextSuggestion: null,
        }),
      );
      expect(res.body.periodStart <= kstDate()).toBe(true);
      expect(res.body.periodEnd >= kstDate()).toBe(true);
      await http
        .get('/api/v1/reports/summary?period=year')
        .set(auth(user))
        .expect(400);
    });

    it('A61~A63 AI 리포트 목록·상세·읽음', async () => {
      const user = await createUserWith(app, db);
      const runId = newId();
      await db.query(
        `INSERT INTO ai_analysis_runs
              (id, user_id, run_type, period_start, period_end)
         VALUES ($1,$2,'weekly_report','2026-11-02','2026-11-08')`,
        [runId, user.id],
      );
      // 결과는 열린(requested) 실행에만 붙일 수 있으므로 먼저 넣고 실행을 완료한다
      await db.query(
        `INSERT INTO ai_reports (run_id, run_type, user_id, title, summary, content_json, feedback)
         VALUES ($1,'weekly_report',$2,'주간 리포트','잘 하셨어요','{"highlights":["5일 연속"]}','아침이 잘 맞아요')`,
        [runId, user.id],
      );
      await db.query(
        `UPDATE ai_analysis_runs
            SET status = 'completed', engine_version = 'test@1', completed_at = now()
          WHERE id = $1`,
        [runId],
      );

      const list = await http
        .get('/api/v1/ai-reports?runType=weekly_report')
        .set(auth(user))
        .expect(200);
      expect(list.body.items[0]).toEqual(
        expect.objectContaining({
          runId,
          runType: 'weekly_report',
          periodStart: '2026-11-02',
          periodEnd: '2026-11-08',
          summary: '잘 하셨어요',
          feedback: '아침이 잘 맞아요',
          highlights: ['5일 연속'],
          readAt: null,
        }),
      );

      await http
        .post(`/api/v1/ai-reports/${runId}/read`)
        .set(auth(user))
        .expect(204);
      const detail = await http
        .get(`/api/v1/ai-reports/${runId}`)
        .set(auth(user))
        .expect(200);
      expect(detail.body.readAt).not.toBeNull();

      const other = await createUserWith(app, db);
      await http
        .get(`/api/v1/ai-reports/${runId}`)
        .set(auth(other))
        .expect(404);
    });

    it('A64 달력은 그 달의 모든 날짜를 돌려줌', async () => {
      const user = await createUserWith(app, db);
      const res = await http
        .get('/api/v1/calendar?month=2026-02')
        .set(auth(user))
        .expect(200);
      expect(res.body).toHaveLength(28);
      expect(res.body[0]).toEqual({
        date: '2026-02-01',
        totalCount: 0,
        completedCount: 0,
        streakStatus: null,
      });
      await http
        .get('/api/v1/calendar?month=2026-13')
        .set(auth(user))
        .expect(400);
    });
  },
);
