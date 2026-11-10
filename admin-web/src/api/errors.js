// Converts any thrown value from axios into an AdminError (docs/05 §2.2).
// Screens branch on `error.code` and show `error.message` as it is.

// Used when the server answers without the standard `{ error: { code, message, details } }` body.
// Codes and messages are the ones in docs/05 §7.1.
const STATUS_FALLBACKS = {
  401: { code: 'COMMON_UNAUTHORIZED', message: '로그인이 필요해요.' },
  403: { code: 'COMMON_FORBIDDEN', message: '권한이 없어요.' },
  404: { code: 'COMMON_NOT_FOUND', message: '찾을 수 없어요.' },
};
const INTERNAL_ERROR = { code: 'COMMON_INTERNAL', message: '잠시 후 다시 시도해 주세요.' };

// Client-side codes (the server never sends them). Names and messages follow docs/05 §7.7.
const NETWORK_ERROR = { code: 'NETWORK_ERROR', message: '인터넷 연결을 확인해 주세요.' };
const NETWORK_TIMEOUT = { code: 'NETWORK_TIMEOUT', message: '응답이 늦어요. 다시 시도해 주세요.' };

export class AdminError extends Error {
  /**
   * @param {{code: string, message: string, details?: object|null, status?: number}} fields
   */
  constructor({ code, message, details = null, status = 0 }) {
    super(message);
    this.name = 'AdminError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

/**
 * @param {unknown} error an axios error (or anything else that was thrown)
 * @returns {AdminError} `{code, message, details, status}` (`status` is 0 without a response)
 */
export function toAdminError(error) {
  if (error instanceof AdminError) return error;

  const response = error?.response;
  if (response) {
    const body = response.data?.error;
    if (body && typeof body.code === 'string') {
      return new AdminError({
        code: body.code,
        message: typeof body.message === 'string' ? body.message : INTERNAL_ERROR.message,
        details: body.details ?? null,
        status: response.status,
      });
    }
    const fallback = STATUS_FALLBACKS[response.status] ?? INTERNAL_ERROR;
    return new AdminError({ ...fallback, status: response.status });
  }

  const isTimeout = error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT';
  return new AdminError({ ...(isTimeout ? NETWORK_TIMEOUT : NETWORK_ERROR), status: 0 });
}
