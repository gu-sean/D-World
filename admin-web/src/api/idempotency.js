/**
 * Creates an Idempotency-Key: one UUID v4 per user action (docs/05 §5.1, §5.2).
 * When an action is retried, reuse the same key (do not call this again).
 * @returns {string}
 */
export const newIdempotencyKey = () => crypto.randomUUID();
