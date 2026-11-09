import { jest } from '@jest/globals';
import {
  createPushSender,
  FcmPushSender,
} from '../../../src/notices/push/push-sender.js';

describe('FcmPushSender', () => {
  it('notification과 linkScreen data로 발송', async () => {
    const send = jest.fn().mockResolvedValue('id');
    await new FcmPushSender({ send }).send({
      token: 't',
      title: '제목',
      body: '본문',
      linkScreen: 'MISSION-01',
    });
    expect(send).toHaveBeenCalledWith({
      token: 't',
      notification: { title: '제목', body: '본문' },
      data: { linkScreen: 'MISSION-01' },
    });
  });

  it('쓸 수 없는 토큰 오류는 invalidToken 표시', async () => {
    const error = Object.assign(new Error('x'), {
      code: 'messaging/registration-token-not-registered',
    });
    const sender = new FcmPushSender({
      send: jest.fn().mockRejectedValue(error),
    });
    await expect(
      sender.send({ token: 't', title: 'a', body: 'b' }),
    ).rejects.toMatchObject({
      invalidToken: true,
    });
  });

  it('그 밖의 오류는 invalidToken 없이 그대로 던짐', async () => {
    const error = Object.assign(new Error('x'), {
      code: 'messaging/internal-error',
    });
    const sender = new FcmPushSender({
      send: jest.fn().mockRejectedValue(error),
    });
    await expect(
      sender.send({ token: 't', title: 'a', body: 'b' }),
    ).rejects.not.toHaveProperty('invalidToken');
  });
});

describe('createPushSender', () => {
  it('console 드라이버는 firebase-admin 없이 생성', async () => {
    const sender = await createPushSender({ get: () => 'console' });
    expect(typeof sender.send).toBe('function');
  });
});
