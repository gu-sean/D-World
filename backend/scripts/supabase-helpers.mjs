// supabase.mjs 가 쓰는 순수 함수 (단위 테스트 대상)

/** .env 형식 텍스트를 { KEY: 값 } 으로 (주석·빈 줄 무시, 값의 따옴표 제거) */
export function parseEnvFile(text) {
  const result = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

/** 접속 주소에서 비밀번호를 가린다 (로그·화면 출력용) */
export function maskUrl(url) {
  return String(url).replace(/(:\/\/[^:/@]+:)[^@]*@/, '$1****@');
}

/** 연결 오류를 원인과 조치가 보이는 문장으로 */
export function explainConnectionError(error) {
  // 오류 문구에 접속 주소가 섞여도 비밀번호는 가려서 보여 줌
  const message = maskUrl(String(error?.message ?? error));
  const code = error?.code ?? '';
  if (code === '28P01' || /password authentication failed/i.test(message)) {
    return '비밀번호가 맞지 않아요. backend/.env.supabase 의 DATABASE_URL 비밀번호를 확인해 주세요.\n  (비밀번호에 @ : / # % 가 있으면 %40 처럼 URL 인코딩해야 해요)';
  }
  if (/tenant or user not found/i.test(message)) {
    return '접속 계정 또는 프로젝트를 찾을 수 없어요. 사용자 이름이 postgres.<프로젝트ID> 형태인지, 풀러 주소(aws-0-…pooler.supabase.com)인지 확인해 주세요.';
  }
  if (/self[- ]signed|certificate|unable to verify/i.test(message)) {
    return `서버 인증서를 검증하지 못했어요 (${message}).\n  DATABASE_SSL_CA=certs/supabase-prod-ca-2021.crt 가 .env.supabase 에 있는지, git pull 로 certs 폴더를 받았는지 확인해 주세요.`;
  }
  if (
    ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'EAI_AGAIN'].includes(code) ||
    /timeout|ECONN/i.test(message)
  ) {
    return `DB에 연결하지 못했어요 (${code || message}).\n  Supabase 무료 프로젝트는 오래 안 쓰면 일시 중지돼요 → 대시보드에서 "Resume project" 를 눌러 주세요.\n  그래도 안 되면 네트워크·방화벽을 확인해 주세요. (직접 연결 주소 db.…supabase.co 는 IPv6 전용이라 풀러 주소를 써야 해요)`;
  }
  return `DB 연결에 실패했어요: ${message}`;
}
