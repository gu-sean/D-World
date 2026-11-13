import { configureApp } from '../../src/app.setup.js';
import { randomInt, randomBytes } from 'node:crypto';
import { newId } from '../../src/common/ids.js';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { AccessTokenService } from '../../src/common/auth/access-token.service.js';
import { SessionsService } from '../../src/common/auth/sessions.service.js';
import { DatabaseService } from '../../src/database/database.service.js';
import { PointsService } from '../../src/points/points.service.js';

// DATABASE_URL이 있을 때만 실행, 마이그레이션 적용 필요
const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('포인트 (PostgreSQL)', () => {
  let app;
  let db;
  let points;
  let adminId;

  const tx = (fn) => db.withTransaction(fn);

  async function createUser() {
    const id = newId();
    await db.query('INSERT INTO users (id) VALUES ($1)', [id]);
    return id;
  }

  /** 승인된 판정까지 갖춘 미션 (보상표 버전은 금액마다 새로 만듦) */
  async function createMission(userId, rewardPoints) {
    const ids = {
      category: newId(),
      difficulty: newId(),
      rate: newId(),
      mission: newId(),
      record: newId(),
      criteria: newId(),
      result: newId(),
    };
    const tag = randomBytes(6).toString('hex'); // 공유 DB에 쌓여도 충돌하지 않게 넓은 범위
    await db.query(
      `INSERT INTO goal_categories (id, code, name, display_order)
       VALUES ($1, $2, $3, 1)`,
      [ids.category, `c${tag}`, `카테고리${tag}`],
    );
    await db.query(
      `INSERT INTO difficulty_levels (id, code, name, display_order)
       VALUES ($1, $2, $3, 1)`,
      [ids.difficulty, `d${tag}`, `난이도${tag}`],
    );
    if (rewardPoints > 0) {
      await db.query(
        `INSERT INTO mission_reward_rate_versions
                (id, category_id, difficulty_id, version_no, points,
                 effective_at, created_by_admin_id)
         VALUES ($1, $2, $3, 1, $4, now() - interval '1 day', $5)`,
        [ids.rate, ids.category, ids.difficulty, rewardPoints, adminId],
      );
    }
    await db.query(
      `INSERT INTO missions
              (id, user_id, source_type, title, category_id, difficulty_id,
               verification_method, scheduled_date, reward_points,
               reward_rate_version_id)
       VALUES ($1, $2, 'user', '걷기', $3, $4, 'sensor', CURRENT_DATE, $5, $6)`,
      [
        ids.mission,
        userId,
        ids.category,
        ids.difficulty,
        rewardPoints,
        rewardPoints > 0 ? ids.rate : null,
      ],
    );
    await db.query(
      `INSERT INTO mission_records
              (id, mission_id, user_id, attempt_no, submission_no,
               status, evidence_kind, submitted_at)
       VALUES ($1, $2, $3, 1, 1, 'submitted', 'sensor_summary', now())`,
      [ids.record, ids.mission, userId],
    );
    await db.query(
      `INSERT INTO verification_criteria_versions
              (id, category_id, verification_method, version_no,
               rules_json, effective_at, created_by_admin_id)
       VALUES ($1, $2, 'sensor', 1, '{}'::jsonb, now() - interval '1 day', $3)`,
      [ids.criteria, ids.category, adminId],
    );
    await db.query(
      `INSERT INTO verification_results
              (id, record_id, result_no, source, decision,
               criteria_version_id, engine_version)
       VALUES ($1, $2, 1, 'ai', 'approved', $3, 'model-v1')`,
      [ids.result, ids.record, ids.criteria],
    );
    return { missionId: ids.mission, resultId: ids.result, rewardPoints };
  }

  const award = (userId, mission) =>
    tx((t) =>
      points.awardMissionPoints(t, {
        userId,
        missionId: mission.missionId,
        resultId: mission.resultId,
        originalPoints: mission.rewardPoints,
      }),
    );
  const revoke = (userId, mission, resultId = newId()) =>
    tx((t) =>
      points.revokeMissionPoints(t, {
        userId,
        missionId: mission.missionId,
        resultId,
      }),
    );
  const reinstate = (userId, mission, resultId = newId()) =>
    tx((t) =>
      points.reinstateMissionPoints(t, {
        userId,
        missionId: mission.missionId,
        resultId,
      }),
    );
  const adjust = (userId, kind, amount) =>
    tx((t) =>
      points.manualAdjust(t, {
        adminId,
        userId,
        kind,
        amount,
        reason: '테스트 조정',
      }),
    );

  const wallet = async (userId) => {
    const { rows } = await db.query(
      `SELECT available_points::int AS available,
              outstanding_recovery_points::int AS outstanding
         FROM point_wallets WHERE user_id = $1`,
      [userId],
    );
    return rows[0] ?? { available: 0, outstanding: 0 };
  };
  const usage = async (userId) => {
    const { rows } = await db.query(
      `SELECT gross_auto_awarded_points::int AS gross,
              same_month_recovered_points::int AS recovered
         FROM point_monthly_usage WHERE user_id = $1`,
      [userId],
    );
    return rows[0];
  };
  const kinds = async (userId) => {
    const { rows } = await db.query(
      `SELECT kind FROM point_transactions WHERE user_id = $1
        `,
      [userId],
    );
    // 한 트랜잭션의 거래는 occurred_at이 같아 순서가 정해지지 않으므로 정렬해 비교
    return rows.map((r) => r.kind).sort();
  };
  const setUsage = (userId, gross) =>
    db.query(
      `INSERT INTO point_monthly_usage (user_id, month_start_date, gross_auto_awarded_points)
       VALUES ($1, date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')::date, $2)`,
      [userId, gross],
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DatabaseService);
    points = app.get(PointsService);

    adminId = newId();
    await db.query(
      `INSERT INTO admin_accounts (id, login_id, email, password_hash)
       VALUES ($1, $2, $3, 'x')`,
      [
        adminId,
        `pa_${randomInt(100_000, 999_999)}`,
        `${adminId.toLowerCase()}@example.com`,
      ],
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('적립', () => {
    it('미션 보상 지급, 같은 호출 반복은 한 번만 반영', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);

      const first = await award(user, mission);
      expect(first).toMatchObject({
        outcome: 'created',
        originalPoints: 100,
        paidPoints: 100,
        capped: false,
        balance: 100,
      });
      const again = await award(user, mission);
      expect(again.outcome).toBe('already_applied');

      expect(await wallet(user)).toEqual({ available: 100, outstanding: 0 });
      expect(await usage(user)).toEqual({ gross: 100, recovered: 0 });
      expect(await kinds(user)).toEqual(['auto_award']);
    });

    it('같은 미션을 다른 금액으로 지급하려 하면 409', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);
      await expect(
        award(user, { ...mission, rewardPoints: 200 }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('월 한도 잔여분만 지급하고 초과분은 소멸, 한도가 차면 0P 지급 행만 남김', async () => {
      const user = await createUser();
      await setUsage(user, 99_950);
      const nearLimit = await createMission(user, 100);
      const partial = await award(user, nearLimit);
      expect(partial).toMatchObject({ paidPoints: 50, capped: true });

      const row = await db.query(
        `SELECT original_points, paid_points FROM mission_point_awards WHERE mission_id = $1`,
        [nearLimit.missionId],
      );
      expect(row.rows[0]).toEqual({ original_points: 100, paid_points: 50 });
      expect((await usage(user)).gross).toBe(100_000);

      const full = await createMission(user, 100);
      const none = await award(user, full);
      expect(none).toMatchObject({ paidPoints: 0, capped: true });
      expect((await award(user, full)).outcome).toBe('already_applied');
      expect(await wallet(user)).toEqual({ available: 50, outstanding: 0 });
      expect(await kinds(user)).toEqual(['auto_award']);
    });

    it('0P 미션도 지급 행을 남기고 거래는 만들지 않음', async () => {
      const user = await createUser();
      const mission = await createMission(user, 0);
      expect((await award(user, mission)).paidPoints).toBe(0);
      expect(await kinds(user)).toEqual([]);
      const { rowCount } = await db.query(
        'SELECT 1 FROM mission_point_awards WHERE mission_id = $1',
        [mission.missionId],
      );
      expect(rowCount).toBe(1);
    });

    it('음수·소수 금액은 거절', async () => {
      const user = await createUser();
      const mission = await createMission(user, 10);
      await expect(
        award(user, { ...mission, rewardPoints: -1 }),
      ).rejects.toThrow(RangeError);
      await expect(
        award(user, { ...mission, rewardPoints: 1.5 }),
      ).rejects.toThrow(RangeError);
    });

    it('같은 사용자의 동시 지급은 직렬화되어 모두 반영, 같은 미션 동시 지급은 한 번만', async () => {
      const user = await createUser();
      const [a, b, c] = await Promise.all([
        createMission(user, 100),
        createMission(user, 100),
        createMission(user, 100),
      ]);
      await Promise.all([award(user, a), award(user, b), award(user, c)]);
      expect((await wallet(user)).available).toBe(300);

      const same = await createMission(user, 50);
      const results = await Promise.all([award(user, same), award(user, same)]);
      expect(results.map((r) => r.outcome).sort()).toEqual([
        'already_applied',
        'created',
      ]);
      expect((await wallet(user)).available).toBe(350);
    });
  });

  describe('회수', () => {
    it('잔액이 충분하면 전액 회수하고 같은 달 한도를 복원, 반복 호출은 무시', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);

      const res = await revoke(user, mission);
      expect(res).toMatchObject({
        outcome: 'revoked',
        recoveredPoints: 100,
        outstandingPoints: 0,
      });
      expect(await wallet(user)).toEqual({ available: 0, outstanding: 0 });
      expect(await usage(user)).toEqual({ gross: 100, recovered: 100 });
      expect(await kinds(user)).toEqual(['auto_award', 'recovery']);
      expect((await revoke(user, mission)).outcome).toBe('already_applied');
    });

    it('회수된 한도만큼 같은 달에 다시 지급받을 수 있음', async () => {
      const user = await createUser();
      await setUsage(user, 99_900);
      const first = await createMission(user, 100);
      await award(user, first);
      const blocked = await createMission(user, 100);
      expect((await award(user, blocked)).paidPoints).toBe(0);

      await revoke(user, first);
      const retry = await createMission(user, 100);
      expect((await award(user, retry)).paidPoints).toBe(100);
    });

    it('잔액 부족분은 미회수액으로 기록하고 잔액은 음수가 되지 않음', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);
      await adjust(user, 'manual_recovery', 70);

      const res = await revoke(user, mission);
      expect(res).toMatchObject({ recoveredPoints: 30, outstandingPoints: 70 });
      expect(await wallet(user)).toEqual({ available: 0, outstanding: 70 });
      // 한도는 실제로 회수한 30P만 복원
      expect(await usage(user)).toEqual({ gross: 100, recovered: 30 });
    });

    it('이후 적립은 미회수액부터 정산, 한도 집계에는 정산 전 지급액 전체가 포함', async () => {
      const user = await createUser();
      const first = await createMission(user, 100);
      await award(user, first);
      await adjust(user, 'manual_recovery', 70);
      await revoke(user, first);

      const next = await createMission(user, 100);
      const res = await award(user, next);
      expect(res).toMatchObject({ paidPoints: 100, settledPoints: 70 });
      expect(await wallet(user)).toEqual({ available: 30, outstanding: 0 });
      expect((await usage(user)).gross).toBe(200);

      const { rows } = await db.query(
        `SELECT outstanding_points::int AS o, settled_points::int AS s
           FROM point_recovery_claims WHERE user_id = $1`,
        [user],
      );
      expect(rows).toEqual([{ o: 0, s: 70 }]);
      expect(await kinds(user)).toEqual([
        'auto_award',
        'auto_award',
        'award_offset',
        'manual_recovery',
        'recovery',
        'recovery_claim',
      ]);
    });

    it('미회수액이 여러 건이면 오래된 청구부터 정산', async () => {
      const user = await createUser();
      const a = await createMission(user, 100);
      const b = await createMission(user, 100);
      await award(user, a);
      await award(user, b);
      await adjust(user, 'manual_recovery', 200);
      await revoke(user, a);
      await revoke(user, b);
      expect(await wallet(user)).toEqual({ available: 0, outstanding: 200 });

      const next = await createMission(user, 150);
      await award(user, next);
      const { rows } = await db.query(
        `SELECT mission_id, outstanding_points::int AS o, settled_points::int AS s
           FROM point_recovery_claims WHERE user_id = $1 ORDER BY created_at, id`,
        [user],
      );
      expect(rows.map((r) => [r.mission_id, r.o, r.s])).toEqual([
        [a.missionId, 0, 100],
        [b.missionId, 50, 50],
      ]);
      expect(await wallet(user)).toEqual({ available: 0, outstanding: 50 });
    });

    it('지급 기록이 없는 미션 회수는 404', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await expect(revoke(user, mission)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('복구', () => {
    it('재승인하면 즉시 회수분을 돌려주고 한도 집계도 정정', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);
      await revoke(user, mission);

      const res = await reinstate(user, mission);
      expect(res).toMatchObject({ outcome: 'reinstated', returnedPoints: 100 });
      expect(await wallet(user)).toEqual({ available: 100, outstanding: 0 });
      expect(await usage(user)).toEqual({ gross: 100, recovered: 0 });
      expect((await reinstate(user, mission)).outcome).toBe('already_applied');
    });

    it('정산 전 복구: 미회수액을 취소하고 회수분만 반환', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);
      await adjust(user, 'manual_recovery', 70);
      await revoke(user, mission);

      const res = await reinstate(user, mission);
      expect(res.returnedPoints).toBe(30);
      expect(await wallet(user)).toEqual({ available: 30, outstanding: 0 });
      expect(await kinds(user)).toContain('recovery_cancel');
      const { rows } = await db.query(
        `SELECT is_cancelled, outstanding_points::int AS o
           FROM point_recovery_claims WHERE user_id = $1`,
        [user],
      );
      expect(rows).toEqual([{ is_cancelled: true, o: 0 }]);
    });

    it('이미 정산된 금액은 잔액으로 반환, 총 복구액은 원 지급액을 넘지 않음', async () => {
      const user = await createUser();
      const first = await createMission(user, 100);
      await award(user, first);
      await adjust(user, 'manual_recovery', 70);
      await revoke(user, first);
      await award(user, await createMission(user, 100)); // 70 정산, 30 증가
      expect(await wallet(user)).toEqual({ available: 30, outstanding: 0 });

      const res = await reinstate(user, first);
      expect(res.returnedPoints).toBe(100); // 회수분 30 + 정산분 70
      expect(await wallet(user)).toEqual({ available: 130, outstanding: 0 });
      expect((await usage(user)).recovered).toBe(0);
    });

    it('번복 → 복구 → 재번복 순환도 처리', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);
      await revoke(user, mission);
      await reinstate(user, mission);
      const again = await revoke(user, mission);
      expect(again).toMatchObject({ outcome: 'revoked', recoveredPoints: 100 });
      expect(await wallet(user)).toEqual({ available: 0, outstanding: 0 });
      await reinstate(user, mission);
      expect(await wallet(user)).toEqual({ available: 100, outstanding: 0 });
      expect(await usage(user)).toEqual({ gross: 100, recovered: 0 });
    });

    it('0P 지급 미션은 상태만 바뀜', async () => {
      const user = await createUser();
      const mission = await createMission(user, 0);
      await award(user, mission);
      expect((await revoke(user, mission)).outcome).toBe('revoked');
      expect((await reinstate(user, mission)).outcome).toBe('reinstated');
      expect(await kinds(user)).toEqual([]);
    });

    it('활성 지급을 복구하려 하면 이미 처리됨', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);
      expect((await reinstate(user, mission)).outcome).toBe('already_applied');
    });
  });

  describe('관리자 조정', () => {
    it('수동 지급은 한도에 포함되지 않고 미회수액부터 정산', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await award(user, mission);
      await adjust(user, 'manual_recovery', 70);
      await revoke(user, mission);
      expect((await wallet(user)).outstanding).toBe(70);

      const res = await adjust(user, 'manual_grant', 100);
      expect(res).toMatchObject({ balance: 30, outstanding: 0 });
      expect((await usage(user)).gross).toBe(100);
    });

    it('수동 회수는 가용 잔액을 넘을 수 없음, 사유 필수', async () => {
      const user = await createUser();
      await adjust(user, 'manual_grant', 50);
      await expect(adjust(user, 'manual_recovery', 51)).rejects.toMatchObject({
        status: 422,
      });
      await expect(
        tx((t) =>
          points.manualAdjust(t, {
            adminId,
            userId: user,
            kind: 'manual_grant',
            amount: 10,
            reason: ' ',
          }),
        ),
      ).rejects.toThrow(RangeError);
      expect((await wallet(user)).available).toBe(50);
    });

    it('수동 조정은 원장에 관리자와 사유를 남김', async () => {
      const user = await createUser();
      await adjust(user, 'manual_grant', 10);
      const { rows } = await db.query(
        `SELECT created_by_admin_id, reason, source_type FROM point_transactions WHERE user_id = $1`,
        [user],
      );
      expect(rows).toEqual([
        {
          created_by_admin_id: adminId,
          reason: '테스트 조정',
          source_type: 'admin_adjustment',
        },
      ]);
    });
  });

  describe('원자성', () => {
    it('호출자 트랜잭션이 실패하면 지급 행·지갑·원장이 모두 롤백', async () => {
      const user = await createUser();
      const mission = await createMission(user, 100);
      await expect(
        tx(async (t) => {
          await points.awardMissionPoints(t, {
            userId: user,
            missionId: mission.missionId,
            resultId: mission.resultId,
            originalPoints: 100,
          });
          throw new Error('뒤 단계 실패');
        }),
      ).rejects.toThrow('뒤 단계 실패');

      expect(await wallet(user)).toEqual({ available: 0, outstanding: 0 });
      expect(await kinds(user)).toEqual([]);
      const { rowCount } = await db.query(
        'SELECT 1 FROM mission_point_awards WHERE mission_id = $1',
        [mission.missionId],
      );
      expect(rowCount).toBe(0);
      // 롤백 뒤 다시 지급 가능
      expect((await award(user, mission)).outcome).toBe('created');
    });
  });

  describe('스트릭·업적·챌린지 보상', () => {
    // 지급 행(소유 도메인 테이블)은 각 모듈이 만들므로 테스트에서는 FK·트리거를 끄고 최소 행만 넣음
    async function insertSource(sql, params) {
      await tx(async (t) => {
        await t.query('SET LOCAL session_replication_role = replica');
        await t.query(sql, params);
      });
    }

    const sources = {
      async streak(userId, n = 0) {
        const id = newId();
        await insertSource(
          `INSERT INTO streak_milestone_awards
                  (id, user_id, target_success_days, policy_version_id,
                   awarded_points, paid_points, first_achieved_date, status)
           VALUES ($1, $2, $4, $3, 300, 300, CURRENT_DATE, 'active')`,
          [id, userId, newId(), [7, 30, 100][n]],
        );
        return { sourceType: 'streak', sourceId: id };
      },
      async achievement(userId) {
        const id = newId();
        await insertSource(
          `INSERT INTO user_achievements
                  (id, user_id, achievement_id, achievement_version_id,
                   badge_image_id, source_type, source_id, first_achieved_at,
                   awarded_points, paid_points)
           VALUES ($1, $2, $3, $4, $5, 'mission', $6, now(), 300, 300)`,
          [id, userId, newId(), newId(), newId(), newId()],
        );
        return { sourceType: 'achievement', sourceId: id };
      },
      async challenge(userId) {
        const id = newId();
        await insertSource(
          `INSERT INTO challenge_reward_grants
                  (id, participation_id, challenge_id, user_id,
                   first_settlement_run_id, promised_points, paid_points,
                   user_xp, pet_xp, status)
           VALUES ($1, $2, $3, $4, $5, 300, 300, 0, 0, 'active')`,
          [id, newId(), newId(), userId, newId()],
        );
        return { sourceType: 'challenge', sourceId: id };
      },
    };

    const awardAuto = (userId, source, points = 300) =>
      tx((t) =>
        points_.awardAutoPoints(t, {
          userId,
          ...source,
          originalPoints: points,
          key: `${source.sourceType}:award:${source.sourceId}`,
        }),
      );
    const revokeAuto = (userId, source) =>
      tx((t) =>
        points_.revokeAutoPoints(t, {
          userId,
          ...source,
          resultId: newId(),
        }),
      );
    const reinstateAuto = (userId, source) =>
      tx((t) =>
        points_.reinstateAutoPoints(t, {
          userId,
          ...source,
          resultId: newId(),
        }),
      );
    // 테스트 안에서 서비스 인스턴스를 짧게 참조
    let points_;
    beforeAll(() => {
      points_ = points;
    });

    describe.each(['streak', 'achievement', 'challenge'])('%s', (type) => {
      it('적립 후 전액 회수·복구, 반복 호출은 무시', async () => {
        const user = await createUser();
        const source = await sources[type](user);

        expect(await awardAuto(user, source)).toMatchObject({
          outcome: 'created',
          paidPoints: 300,
        });
        expect((await awardAuto(user, source)).outcome).toBe('already_applied');
        expect(await wallet(user)).toEqual({ available: 300, outstanding: 0 });

        expect(await revokeAuto(user, source)).toMatchObject({
          outcome: 'revoked',
          recoveredPoints: 300,
        });
        expect((await revokeAuto(user, source)).outcome).toBe(
          'already_applied',
        );
        expect(await wallet(user)).toEqual({ available: 0, outstanding: 0 });
        expect(await usage(user)).toEqual({ gross: 300, recovered: 300 });

        expect(await reinstateAuto(user, source)).toMatchObject({
          outcome: 'reinstated',
          returnedPoints: 300,
        });
        expect((await reinstateAuto(user, source)).outcome).toBe(
          'already_applied',
        );
        expect(await wallet(user)).toEqual({ available: 300, outstanding: 0 });
        expect(await usage(user)).toEqual({ gross: 300, recovered: 0 });
      });

      it('잔액 부족분은 이 소스를 가리키는 미회수 청구로 기록, 번복·복구를 반복해도 새 청구', async () => {
        const user = await createUser();
        const source = await sources[type](user);
        await awardAuto(user, source);
        await adjust(user, 'manual_recovery', 200);

        const first = await revokeAuto(user, source);
        expect(first).toMatchObject({
          recoveredPoints: 100,
          outstandingPoints: 200,
        });
        expect(await wallet(user)).toEqual({ available: 0, outstanding: 200 });
        const claims = await db.query(
          `SELECT outstanding_points::int AS o, is_cancelled,
                  (streak_milestone_award_id = $2 OR user_achievement_id = $2
                   OR challenge_reward_grant_id = $2) AS linked
             FROM point_recovery_claims WHERE user_id = $1`,
          [user, source.sourceId],
        );
        expect(claims.rows).toEqual([
          { o: 200, is_cancelled: false, linked: true },
        ]);

        // 정산 전 복구: 청구 취소, 즉시 회수분만 반환
        const back = await reinstateAuto(user, source);
        expect(back.returnedPoints).toBe(100);
        expect(await wallet(user)).toEqual({ available: 100, outstanding: 0 });

        // 다시 번복하면 새 청구가 만들어지고 이전 청구는 취소 상태로 남음
        const second = await revokeAuto(user, source);
        expect(second).toMatchObject({
          recoveredPoints: 100,
          outstandingPoints: 200,
        });
        const all = await db.query(
          `SELECT is_cancelled FROM point_recovery_claims
            WHERE user_id = $1 ORDER BY created_at, id`,
          [user],
        );
        expect(all.rows.map((r) => r.is_cancelled).sort()).toEqual([
          false,
          true,
        ]);
        expect((await wallet(user)).outstanding).toBe(200);
      });

      it('회수 후 새 적립이 청구를 정산하고 복구하면 정산분도 돌려줌', async () => {
        const user = await createUser();
        const source = await sources[type](user);
        await awardAuto(user, source);
        await adjust(user, 'manual_recovery', 200);
        await revokeAuto(user, source);

        const other = await sources[type](user, 1);
        const res = await awardAuto(user, other);
        expect(res).toMatchObject({ paidPoints: 300, settledPoints: 200 });
        expect(await wallet(user)).toEqual({ available: 100, outstanding: 0 });

        const back = await reinstateAuto(user, source);
        expect(back.returnedPoints).toBe(300); // 회수분 100 + 정산분 200
        expect(await wallet(user)).toEqual({ available: 400, outstanding: 0 });
      });

      it('같은 지급에 유효한 청구를 두 개 만들 수 없음', async () => {
        const user = await createUser();
        const source = await sources[type](user);
        await awardAuto(user, source);
        await adjust(user, 'manual_recovery', 300);
        await revokeAuto(user, source); // 청구 300
        const column = {
          streak: 'streak_milestone_award_id',
          achievement: 'user_achievement_id',
          challenge: 'challenge_reward_grant_id',
        }[type];
        const award = await db.query(
          `SELECT id FROM point_transactions WHERE user_id = $1 AND kind = 'auto_award'`,
          [user],
        );
        await expect(
          db.query(
            `INSERT INTO point_recovery_claims
                    (id, user_id, ${column}, original_award_transaction_id,
                     target_points, outstanding_points)
             VALUES ($1, $2, $3, $4, 10, 10)`,
            [newId(), user, source.sourceId, award.rows[0].id],
          ),
        ).rejects.toMatchObject({ code: '23505' });
      });
    });

    it('한도가 소진돼 0P가 지급된 소스의 회수는 되돌릴 포인트가 없음', async () => {
      const user = await createUser();
      await setUsage(user, 100_000);
      const source = await sources.streak(user);
      expect(await awardAuto(user, source)).toMatchObject({ paidPoints: 0 });
      expect(await kinds(user)).toEqual([]);
      expect(await revokeAuto(user, source)).toMatchObject({
        outcome: 'revoked',
        recoveredPoints: 0,
      });
      expect((await reinstateAuto(user, source)).outcome).toBe(
        'already_applied',
      );
    });

    it('미션은 이 경로로 처리할 수 없고, 다른 사용자의 소스는 원장 트리거가 거절', async () => {
      const user = await createUser();
      await expect(
        tx((t) =>
          points_.revokeAutoPoints(t, {
            userId: user,
            sourceType: 'mission',
            sourceId: newId(),
            resultId: newId(),
          }),
        ),
      ).rejects.toThrow(RangeError);

      const owner = await createUser();
      const source = await sources.streak(owner);
      await expect(awardAuto(user, source)).rejects.toMatchObject({
        code: '23514',
      });
    });
  });

  describe('조회 API', () => {
    async function login(userId) {
      const sessions = app.get(SessionsService);
      const tokens = app.get(AccessTokenService);
      const session = await tx((t) => sessions.create(t, 'user', userId));
      return tokens.issue('user', userId, session.sessionId);
    }

    it('지갑과 이번 달 한도 현황', async () => {
      const user = await createUser();
      await award(user, await createMission(user, 120));
      const token = await login(user);
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/points')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        availablePoints: 120,
        outstandingRecoveryPoints: 0,
        monthlyLimit: 100_000,
        monthlyUsed: 120,
        monthlyRemaining: 99_880,
      });
      await request(app.getHttpServer()).get('/api/v1/me/points').expect(401);
    });

    it('거래 내역은 최신순 커서 페이지네이션, 같은 시각 거래도 누락·중복 없음', async () => {
      const user = await createUser();
      // 한 트랜잭션에서 여러 거래를 만들어 occurred_at이 같게 함
      const missions = await Promise.all(
        [1, 2, 3, 4, 5].map(() => createMission(user, 10)),
      );
      await tx(async (t) => {
        for (const m of missions) {
          await points.awardMissionPoints(t, {
            userId: user,
            missionId: m.missionId,
            resultId: m.resultId,
            originalPoints: 10,
          });
        }
      });
      const token = await login(user);
      const http = request(app.getHttpServer());
      const seen = [];
      let cursor;
      for (let page = 0; page < 5; page++) {
        const res = await http
          .get('/api/v1/me/points/transactions')
          .query({ limit: 2, ...(cursor ? { cursor } : {}) })
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        seen.push(...res.body.items.map((i) => i.id));
        cursor = res.body.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toHaveLength(5);
      expect(new Set(seen).size).toBe(5);

      await http
        .get('/api/v1/me/points/transactions')
        .query({ limit: 0 })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
      await http
        .get('/api/v1/me/points/transactions')
        .query({ cursor: 'not-a-cursor' })
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });
});
