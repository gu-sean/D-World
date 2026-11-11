import { Bind, Controller, Dependencies, Get, Query } from '@nestjs/common';
import { AdminOnly } from '../common/auth/admin-auth.guard.js';
import { parseAdminPage, pickEnum } from '../common/pagination/admin-page.js';
import { timestamp, uuid, validateBody } from '../common/validation.js';
import { AuditService } from './audit.service.js';

/** M101 감사 로그 조회 (읽기 전용) */
@Controller('admin/v1/audit-logs')
@AdminOnly()
@Dependencies(AuditService)
export class AuditLogsController {
  constructor(audit) {
    this.audit = audit;
  }

  @Get()
  @Bind(Query())
  list(query) {
    const filters = validateBody(query, {
      adminId: uuid({ optional: true }),
      targetUserId: uuid({ optional: true }),
      from: timestamp({ optional: true }),
      to: timestamp({ optional: true }),
    });
    return this.audit.list({
      ...filters,
      action:
        typeof query.action === 'string' && query.action
          ? query.action.slice(0, 80)
          : undefined,
      result: pickEnum(query, 'result', ['success', 'failure']),
      paging: parseAdminPage(query, {
        'recordedAt,desc': 'l.recorded_at DESC, l.id DESC',
        'recordedAt,asc': 'l.recorded_at ASC, l.id ASC',
      }),
    });
  }
}
