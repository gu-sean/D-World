import {
  BadRequestException,
  Bind,
  Controller,
  Dependencies,
  Get,
  Query,
} from '@nestjs/common';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { dateString, validateBody } from '../common/validation.js';
import { addDays, kstDate, kstDayStart } from '../common/time/kst.js';
import { DatabaseService } from '../database/database.service.js';

const MAX_DAYS = 31;
const DAY_MS = 86_400_000;

const queue = (row) => ({
  count: Number(row.count),
  oldestAt: row.oldest_at ?? null,
});

/**
 * 관리자 대시보드 M05: 기간(KST 날짜, 기본 오늘, 최대 31일) 수치와 처리 대기 큐
 * 큐의 oldestAt은 대기 항목 중 가장 오래된 접수 시각
 */
@Controller('admin/v1/dashboard')
@AdminOnly()
@Dependencies(DatabaseService)
export class AdminDashboardController {
  constructor(database) {
    this.database = database;
  }

  @Get('summary')
  @Bind(Query())
  async summary(query) {
    const today = kstDate();
    const input = validateBody(query, {
      from: dateString({ optional: true }),
      to: dateString({ optional: true }),
    });
    const from = input.from ?? input.to ?? today;
    const to = input.to ?? input.from ?? today;
    const start = kstDayStart(from);
    const end = kstDayStart(addDays(to, 1));
    const days = Math.round((end - start) / DAY_MS);
    if (days < 1) {
      throw new BadRequestException(['to: from보다 빠를 수 없음']);
    }
    if (days > MAX_DAYS) {
      throw new BadRequestException([`to: 기간은 최대 ${MAX_DAYS}일`]);
    }

    const range = [start.toISOString(), end.toISOString()];
    const [
      users,
      records,
      decisions,
      points,
      review,
      appeals,
      tickets,
      withdrawals,
      definitions,
      challenges,
    ] = await Promise.all([
      this.database.query(
        `SELECT count(*) AS n FROM users WHERE created_at >= $1 AND created_at < $2`,
        range,
      ),
      this.database.query(
        `SELECT count(*) AS submitted, count(DISTINCT user_id) AS active_users
           FROM mission_records
          WHERE submitted_at >= $1 AND submitted_at < $2`,
        range,
      ),
      this.database.query(
        `SELECT decision, count(*) AS n FROM verification_results
          WHERE is_current AND decided_at >= $1 AND decided_at < $2
          GROUP BY decision`,
        range,
      ),
      this.database.query(
        `SELECT COALESCE(sum(available_delta) FILTER (WHERE available_delta > 0), 0) AS granted,
                COALESCE(-sum(available_delta) FILTER (WHERE kind = 'spend'), 0) AS spent
           FROM point_transactions
          WHERE occurred_at >= $1 AND occurred_at < $2`,
        range,
      ),
      this.database.query(
        `SELECT count(*) AS count, min(submitted_at) AS oldest_at
           FROM mission_records WHERE status = 'review_required'`,
      ),
      this.database.query(
        `SELECT count(*) AS count, min(filed_at) AS oldest_at
           FROM verification_appeals WHERE status = 'open'`,
      ),
      this.database.query(
        `SELECT count(*) AS count, min(received_at) AS oldest_at
           FROM support_tickets WHERE status <> 'completed'`,
      ),
      this.database.query(
        `SELECT count(*) AS count, min(requested_at) AS oldest_at
           FROM account_withdrawal_requests
          WHERE status IN ('requested', 'on_hold')`,
      ),
      this.database.query(
        `SELECT count(*) AS count, min(r.created_at) AS oldest_at
           FROM mission_definitions d
           JOIN LATERAL (
             SELECT created_at FROM mission_publication_reviews
              WHERE definition_id = d.id AND decision = 'submitted'
              ORDER BY created_at DESC LIMIT 1) r ON true
          WHERE d.publication_status = 'review_pending' AND d.deleted_at IS NULL`,
      ),
      this.database.query(
        `SELECT count(*) AS count, min(r.created_at) AS oldest_at
           FROM challenges c
           JOIN LATERAL (
             SELECT created_at FROM challenge_publication_reviews
              WHERE challenge_id = c.id AND decision = 'submitted'
              ORDER BY created_at DESC LIMIT 1) r ON true
          WHERE c.publication_status = 'review_pending'`,
      ),
    ]);

    const decided = Object.fromEntries(
      decisions.rows.map((row) => [row.decision, Number(row.n)]),
    );
    return {
      from,
      to,
      newUsers: Number(users.rows[0].n),
      activeUsers: Number(records.rows[0].active_users),
      submittedRecords: Number(records.rows[0].submitted),
      approvedRecords: decided.approved ?? 0,
      rejectedRecords: decided.rejected ?? 0,
      reviewRequiredRecords: decided.review_required ?? 0,
      pointsGranted: Number(points.rows[0].granted),
      pointsSpent: Number(points.rows[0].spent),
      queues: {
        verificationReview: queue(review.rows[0]),
        appeals: queue(appeals.rows[0]),
        supportTickets: queue(tickets.rows[0]),
        withdrawals: queue(withdrawals.rows[0]),
        missionDefinitionReviews: queue(definitions.rows[0]),
        challengeReviews: queue(challenges.rows[0]),
      },
    };
  }
}
