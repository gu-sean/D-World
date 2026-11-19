import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { putToStorage } from './imageUploadApi.js';

const ticket = {
  uploadUrl: 'https://storage.example/upload',
  uploadHeaders: { 'Content-Type': 'image/png' },
};
const file = new File(['x'], 'a.png', { type: 'image/png' });

describe('putToStorage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the file with a time limit and without admin credentials', async () => {
    const put = vi.spyOn(axios, 'put').mockResolvedValue({ status: 200 });
    await putToStorage(ticket, file);
    const [url, body, config] = put.mock.calls[0];
    expect(url).toBe(ticket.uploadUrl);
    expect(body).toBe(file);
    expect(config.timeout).toBeGreaterThan(0);
    expect(config.headers).toEqual(ticket.uploadHeaders);
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('reports a timeout', async () => {
    vi.spyOn(axios, 'put').mockRejectedValue({ code: 'ECONNABORTED' });
    await expect(putToStorage(ticket, file)).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
  });

  it('reports a lost connection', async () => {
    vi.spyOn(axios, 'put').mockRejectedValue({ code: 'ERR_NETWORK' });
    await expect(putToStorage(ticket, file)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('hides what the storage answered (its 403 is not an admin permission problem)', async () => {
    vi.spyOn(axios, 'put').mockRejectedValue({
      response: { status: 403, data: '<Error>raw</Error>' },
    });
    const error = await putToStorage(ticket, file).catch((e) => e);
    expect(error.code).toBe('COMMON_INTERNAL');
    expect(error.message).not.toContain('raw');
  });
});
