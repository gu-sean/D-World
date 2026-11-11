import axios from 'axios';
import { AdminError } from '../api/errors.js';
import { http } from '../api/httpClient.js';

/**
 * M84 POST /assets/upload-urls (docs/09 §8, ADM-25·26). Asks for a signed upload URL.
 * @param {{assetKind: 'badge'|'pet_stage', ownerId: string, mimeType: string, sizeBytes: number,
 *   reason: string}} body
 * @param {string} idempotencyKey
 * @returns {Promise<{assetId: string, uploadUrl: string, uploadHeaders: object, expiresAt: string,
 *   objectKey: string}>} AssetUploadTicket (docs/07)
 */
export const createUploadUrl = (body, idempotencyKey) =>
  http.post('/assets/upload-urls', body, { idempotencyKey }).then((r) => r.data);

/**
 * PUT of the file to the signed URL of the ticket. This goes to the storage, not to the admin
 * API, so it uses plain axios: no admin access token, no Idempotency-Key.
 * @param {{uploadUrl: string, uploadHeaders: Record<string, string>}} ticket
 * @param {File} file
 */
export const putToStorage = async (ticket, file) => {
  try {
    await axios.put(ticket.uploadUrl, file, { headers: ticket.uploadHeaders });
  } catch {
    // The storage answers in its own format (and 403 here does not mean "no admin permission").
    throw new AdminError({ code: 'COMMON_INTERNAL', message: '잠시 후 다시 시도해 주세요.' });
  }
};

/**
 * M85 POST /assets/{assetId}/complete (docs/09 §8). The body is `{reason}` because every admin
 * change needs a `reason` (docs/05 §5.2), although docs/09 §8 lists no request body for M85.
 * @param {string} assetId
 * @param {{reason: string}} body
 * @param {string} idempotencyKey
 * @returns {Promise<{assetId: string, imageUrl: string}>}
 */
export const completeUpload = (assetId, body, idempotencyKey) =>
  http.post(`/assets/${assetId}/complete`, body, { idempotencyKey }).then((r) => r.data);
