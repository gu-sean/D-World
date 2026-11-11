/**
 * 리포트·알림·공지·문의 가짜 응답 (A60~A64, A110~A122). 07 §10·§15 모양.
 */
import { todayKst } from '../../format/format.js';
import { dayOffset } from './goals.js';

/** A60 `ReportSummary` */
export function reportSummary(params = {}, nowMs = Date.now()) {
  const period = params.period ?? 'week';
  return {
    period,
    periodStart: dayOffset(-6, nowMs),
    periodEnd: todayKst(nowMs),
    categoryCode: params.categoryCode ?? null,
    completedMissionCount: 9,
    plannedMissionCount: 14,
    goalProgressRate: 0.25,
    achievementRate: 0.6429,
    streakDays: 5,
    categories: [
      { categoryCode: 'exercise', name: '운동', completedCount: 6, plannedCount: 8, achievementRate: 0.75 },
      { categoryCode: 'study', name: '학습', completedCount: 2, plannedCount: 4, achievementRate: 0.5 },
      { categoryCode: 'lifestyle', name: '생활습관', completedCount: 1, plannedCount: 2, achievementRate: 0.5 },
    ],
    insight: {
      aiReportRunId: 'ai-report-0001',
      summary: '이번 주는 운동 미션을 잘 해내셨어요.',
      feedback: '학습 미션은 저녁보다 아침이 잘 맞는 것 같아요.',
    },
    nextSuggestion: { text: '내일은 학습 미션을 아침에 넣어 볼까요?', planAdjustmentId: 'adjustment-0001' },
  };
}

/** A61·A62 `AiReport` */
export function aiReport(runId = 'ai-report-0001', nowMs = Date.now()) {
  return {
    runId,
    runType: 'weekly_report',
    periodStart: dayOffset(-6, nowMs),
    periodEnd: todayKst(nowMs),
    summary: '이번 주는 운동 미션을 잘 해내셨어요.',
    feedback: '학습 미션은 저녁보다 아침이 잘 맞는 것 같아요.',
    highlights: ['운동 달성률 75%', '5일 연속 달성 중'],
    engineVersion: 'mock-report@0.1.0',
    readAt: null,
    createdAt: new Date(nowMs - 86400000).toISOString(),
  };
}

/** A64 `CalendarDay[]` — 그 달 1일~말일 */
export function calendarDays(month, nowMs = Date.now()) {
  const [year, m] = String(month).split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const today = todayKst(nowMs);
  return Array.from({ length: lastDay }, (_, i) => {
    const date = `${year}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const total = date <= today ? 2 : 0;
    const completed = date < today ? 1 : 0;
    return {
      date,
      totalCount: total,
      completedCount: completed,
      streakStatus: date < today ? 'success' : (date === today ? 'pending' : null),
    };
  });
}

/** A110 `Notification[]` */
export function notifications(nowMs = Date.now()) {
  return [
    {
      id: 'notification-0002', kind: 'system', title: '이번 주 리포트가 도착했어요',
      body: '지난 7일을 정리했어요.', linkScreen: 'reports/ai/ai-report-0001',
      readAt: null, createdAt: new Date(nowMs - 3600000).toISOString(),
    },
    {
      id: 'notification-0001', kind: 'notice', title: '서비스 점검 안내',
      body: '11월 10일 02:00~04:00에 점검이 있어요.', linkScreen: 'notices/notice-0001',
      readAt: new Date(nowMs - 86400000).toISOString(), createdAt: new Date(nowMs - 2 * 86400000).toISOString(),
    },
  ];
}

/** A113·A114 `Notice[]` */
export function notices(nowMs = Date.now()) {
  return [
    {
      id: 'notice-0001', category: 'service', title: '서비스 점검 안내',
      body: '11월 10일 02:00~04:00에 점검이 있어요. 이용에 참고해 주세요.',
      linkScreen: null, publishedAt: new Date(nowMs - 2 * 86400000).toISOString(),
    },
    {
      id: 'notice-0002', category: 'event', title: '첫 챌린지 이벤트',
      body: '이번 달 챌린지를 완주하면 보너스 포인트를 드려요.',
      linkScreen: 'challenges/challenge-0001', publishedAt: new Date(nowMs - 5 * 86400000).toISOString(),
    },
  ];
}

/** A121·A122 `SupportTicket[]` */
export function supportTickets(nowMs = Date.now()) {
  return [
    {
      id: 'ticket-0001', ticketType: 'inquiry', category: 'verification',
      subject: '인증이 자꾸 실패해요', body: '스쿼트 영상이 계속 거절돼요.',
      status: 'completed', receivedAt: new Date(nowMs - 3 * 86400000).toISOString(),
      completedAt: new Date(nowMs - 2 * 86400000).toISOString(),
      replies: [{ body: '촬영 거리를 2~3m로 두고 다시 시도해 주세요.', createdAt: new Date(nowMs - 2 * 86400000).toISOString() }],
    },
  ];
}

export default { reportSummary, aiReport, calendarDays, notifications, notices, supportTickets };
