import { http as mswHttp } from 'msw';
import { BASE, errorResponse } from '../../mocks/helpers.js';

// M110 (docs/09 §11): every billing endpoint answers 501 COMMON_NOT_IMPLEMENTED (docs/05 §7).
const notImplemented = () => errorResponse(501, 'COMMON_NOT_IMPLEMENTED', '준비 중인 기능이에요.');

export const handlers = [
  mswHttp.get(`${BASE}/subscriptions`, notImplemented),
  mswHttp.get(`${BASE}/payments`, notImplemented),
  mswHttp.post(`${BASE}/payments/:paymentId/refunds`, notImplemented),
  mswHttp.post(`${BASE}/users/:userId/entitlements/restore`, notImplemented),
];
