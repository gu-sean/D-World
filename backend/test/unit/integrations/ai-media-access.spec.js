import { jest } from '@jest/globals';
import {
  AiClient,
  warnsObjectKeyInProduction,
} from '../../../src/integrations/ai/ai.client.js';

const configOf = (values) => ({ get: (key) => values[key] });
const base = {
  NODE_ENV: 'production',
  AI_SERVICE_URL: 'http://ai:8001',
  INTERNAL_API_TOKEN: 'x'.repeat(32),
};

describe('AI 파일 접근 방식 경고', () => {
  it('운영 + AI 사용 + object_key면 경고 대상', () => {
    expect(warnsObjectKeyInProduction(configOf(base))).toBe(true);
    expect(
      warnsObjectKeyInProduction(
        configOf({ ...base, AI_MEDIA_ACCESS: 'object_key' }),
      ),
    ).toBe(true);
  });

  it('signed_url, 개발 환경, AI 미사용이면 경고하지 않음', () => {
    expect(
      warnsObjectKeyInProduction(
        configOf({ ...base, AI_MEDIA_ACCESS: 'signed_url' }),
      ),
    ).toBe(false);
    expect(
      warnsObjectKeyInProduction(
        configOf({ ...base, NODE_ENV: 'development' }),
      ),
    ).toBe(false);
    expect(
      warnsObjectKeyInProduction(configOf({ ...base, AI_SERVICE_URL: '' })),
    ).toBe(false);
  });

  it('시작할 때 경고를 남김', () => {
    const client = new AiClient(configOf(base));
    const warn = jest.fn();
    client.logger = { warn };
    client.onModuleInit();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
