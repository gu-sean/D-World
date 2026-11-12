import { http } from '../../api/httpClient.js';

// Every change sends the Idempotency-Key header and a `reason` in the body (docs/09 §0 rules 3, 4).
// The lists are `AdminPage<T>` (docs/09 §0 rule 7); docs/09 does not list the filters of M90, M95
// and M98, so only `page`, `size`, and for M90 `status` and `category` are sent.

/**
 * M90 GET /notices (ADM-32, ADM-33)
 * @param {{status?, category?, page, size}} params
 * @returns {Promise<object>} AdminPage<NoticeAdmin>
 */
export const fetchNotices = (params) => http.get('/notices', { params }).then((r) => r.data);

/**
 * M91 POST /notices → 201 NoticeAdmin (status `draft`)
 * @param {object} body category, title, body, linkScreen?, audienceType, userIds?, showInList,
 *   sendPush, policyDocumentVersionId?, scheduledAt?, reason
 * @param {string} idempotencyKey
 */
export const createNotice = (body, idempotencyKey) =>
  http.post('/notices', body, { idempotencyKey }).then((r) => r.data);

/** M92 PATCH /notices/{noticeId}: only a `draft` can be edited. Same body as M91. */
export const updateNotice = (noticeId, body, idempotencyKey) =>
  http.patch(`/notices/${noticeId}`, body, { idempotencyKey }).then((r) => r.data);

/**
 * M93 POST /notices/{noticeId}/publish
 * @param {string} noticeId
 * @param {{scheduledAt: string|null, reason: string}} body `null` publishes now
 * @param {string} idempotencyKey
 */
export const publishNotice = (noticeId, body, idempotencyKey) =>
  http.post(`/notices/${noticeId}/publish`, body, { idempotencyKey }).then((r) => r.data);

/** M94 POST /notices/{noticeId}/cancel: `{reason}`, only `draft` and `scheduled` */
export const cancelNotice = (noticeId, body, idempotencyKey) =>
  http.post(`/notices/${noticeId}/cancel`, body, { idempotencyKey }).then((r) => r.data);

/**
 * M95 GET /policy-documents (ADM-34)
 * @param {{page, size}} params
 * @returns {Promise<object>} AdminPage<PolicyDocumentAdmin>
 */
export const fetchPolicyDocuments = (params) =>
  http.get('/policy-documents', { params }).then((r) => r.data);

/** M96 POST /policy-documents → 201 PolicyDocumentAdmin (not published yet) */
export const createPolicyDocument = (body, idempotencyKey) =>
  http.post('/policy-documents', body, { idempotencyKey }).then((r) => r.data);

/** M97 POST /policy-documents/{versionId}/publish: `{reason}`; a published version is fixed */
export const publishPolicyDocument = (versionId, body, idempotencyKey) =>
  http.post(`/policy-documents/${versionId}/publish`, body, { idempotencyKey }).then((r) => r.data);

/**
 * M98 GET /recommendation-messages (ADM-35)
 * @param {{page, size}} params
 * @returns {Promise<object>} AdminPage<RecommendationMessageAdmin>
 */
export const fetchRecommendationMessages = (params) =>
  http.get('/recommendation-messages', { params }).then((r) => r.data);

/** M99 POST /recommendation-messages: RecommendationMessageAdmin without `id`, plus `reason` */
export const createRecommendationMessage = (body, idempotencyKey) =>
  http.post('/recommendation-messages', body, { idempotencyKey }).then((r) => r.data);

/** M100 PATCH /recommendation-messages/{messageId}: same body as M99 */
export const updateRecommendationMessage = (messageId, body, idempotencyKey) =>
  http.patch(`/recommendation-messages/${messageId}`, body, { idempotencyKey }).then((r) => r.data);
