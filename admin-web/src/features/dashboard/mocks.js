import { delay, http as mswHttp, HttpResponse } from 'msw';
import { BASE, errorResponse } from '../../mocks/helpers.js';
import { countDays, MAX_PERIOD_DAYS, todayInSeoul } from './period.js';

// MSW handler for M05 (docs/09 §2). The numbers grow with the length of the period, so changing
// the period visibly changes the screen.
export const handlers = [
  mswHttp.get(`${BASE}/dashboard/summary`, async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const from = url.searchParams.get('from') ?? todayInSeoul();
    const to = url.searchParams.get('to') ?? from;
    const days = countDays(from, to);
    if (days < 1 || days > MAX_PERIOD_DAYS) {
      return errorResponse(400, 'COMMON_VALIDATION_FAILED', '입력한 내용을 다시 확인해 주세요.');
    }
    return HttpResponse.json({
      from,
      to,
      activeUserCount: 12 * days + 3,
      missionCount: 40 * days,
      pendingVerificationCount: 7,
      openReportCount: 3,
      queues: [
        { type: 'verification', count: 7, oldestAt: '2026-11-10T01:20:00.000Z' },
        { type: 'report', count: 3, oldestAt: '2026-11-09T05:00:00.000Z' },
        { type: 'inquiry', count: 5, oldestAt: '2026-11-11T02:10:00.000Z' },
        { type: 'withdrawal', count: 0, oldestAt: null },
        { type: 'appeal', count: 2, oldestAt: '2026-11-10T08:45:00.000Z' },
      ],
      aggregatedAt: new Date().toISOString(),
    });
  }),
];
