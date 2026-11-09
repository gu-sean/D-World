// 관리자 응답의 개인정보 마스킹 (팀 문서 09 §0-6)

/** 휴대폰: 01012345678 / +821012345678 / 010-1234-5678 → 010-****-5678, 해석할 수 없으면 전부 가림 */
export function maskPhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  const national = digits.startsWith('82') ? `0${digits.slice(2)}` : digits;
  if (!/^01\d{8,9}$/.test(national)) return '***';
  return `${national.slice(0, 3)}-****-${national.slice(-4)}`;
}

/** 이메일: abc@example.com → a***@example.com, 형식이 다르면 전부 가림 */
export function maskEmail(value) {
  if (typeof value !== 'string') return null;
  const at = value.lastIndexOf('@');
  if (at < 1 || at === value.length - 1) return '***';
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}
