import { ConsentService } from '../../../src/accounts/consent.service.js';
import { maskPhone } from '../../../src/accounts/accounts.service.js';

const current = [
  { id: 't1', document_type: 'terms' },
  { id: 'p1', document_type: 'privacy' },
  { id: 'm1', document_type: 'marketing' },
];

describe('ConsentService.assertSignupConsents', () => {
  const service = new ConsentService(null);

  it('필수 문서에 모두 동의하면 통과, 마케팅은 선택', () => {
    expect(() =>
      service.assertSignupConsents(current, [
        { documentVersionId: 't1', granted: true },
        { documentVersionId: 'p1', granted: true },
      ]),
    ).not.toThrow();
  });

  it('필수 문서 누락 또는 거부 시 422', () => {
    for (const consents of [
      [{ documentVersionId: 't1', granted: true }],
      [
        { documentVersionId: 't1', granted: true },
        { documentVersionId: 'p1', granted: false },
      ],
    ]) {
      expect(() => service.assertSignupConsents(current, consents)).toThrow(
        expect.objectContaining({ status: 422 }),
      );
    }
  });

  it('필수 문서 철회·옛 버전 동의는 거절', async () => {
    const tx = { query: async () => ({}) };
    await expect(
      service.record(
        tx,
        'u',
        [{ documentVersionId: 't1', granted: false }],
        current,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      service.record(
        tx,
        'u',
        [{ documentVersionId: 'old', granted: true }],
        current,
      ),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('maskPhone', () => {
  it('뒤 4자리만 노출', () => {
    expect(maskPhone('+821012345678')).toBe('+82******5678');
  });
});
