import {
  explainConnectionError,
  maskUrl,
  parseEnvFile,
} from '../../../scripts/supabase-helpers.mjs';

describe('scripts/supabase-helpers.mjs', () => {
  it('.env 텍스트를 읽음 (주석·빈 줄 무시, 따옴표 제거, 값 안의 = 유지)', () => {
    expect(
      parseEnvFile('# 설명\nA=1\n\nB = "x y"\nC=postgres://u:p=q@h/db\r\nD=\n'),
    ).toEqual({ A: '1', B: 'x y', C: 'postgres://u:p=q@h/db', D: '' });
  });

  it('접속 주소의 비밀번호를 가림', () => {
    expect(maskUrl('postgresql://postgres.abc:fjf!pw@host:5432/postgres')).toBe(
      'postgresql://postgres.abc:****@host:5432/postgres',
    );
    expect(maskUrl('postgres://u@h/db')).toBe('postgres://u@h/db');
  });

  it.each([
    [
      { code: '28P01', message: 'password authentication failed' },
      '비밀번호가 맞지 않아요',
    ],
    [{ message: 'Tenant or user not found' }, 'postgres.<프로젝트ID>'],
    [
      { message: 'self-signed certificate in certificate chain' },
      'DATABASE_SSL_CA',
    ],
    [{ code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' }, 'Resume project'],
    [{ code: 'ETIMEDOUT', message: 'timeout' }, 'Resume project'],
    [{ message: '알 수 없는 오류' }, '알 수 없는 오류'],
  ])('연결 오류 안내: %j', (error, expected) => {
    expect(explainConnectionError(error)).toContain(expected);
  });

  it('안내 문구에 비밀번호가 섞이지 않음', () => {
    const text = explainConnectionError(
      new Error('connect to postgresql://u:SECRET@h failed'),
    );
    expect(text).toContain('DB 연결에 실패했어요');
    expect(text).not.toContain('SECRET');
  });
});
