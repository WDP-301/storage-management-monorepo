import { Logger } from '@nestjs/common';
import { HoldstationClient } from './holdstation.client';

const env: Record<string, string | undefined> = {
  HOLDSTATION_API_URL: 'https://pay.example/api/v1/',
  HOLDSTATION_PARTNER_APP_KEY: 'secret-key',
};
const config = { get: jest.fn((key: string) => env[key]) };
const reply = (status: number, body: unknown) =>
  ({ ok: status < 300, status, json: async () => body }) as Response;

describe('HoldstationClient', () => {
  let fetchMock: jest.SpyInstance;
  let client: HoldstationClient;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    client = new HoldstationClient(config as never);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    env.HOLDSTATION_PARTNER_APP_KEY = 'secret-key';
  });

  const verified = {
    bank: { bank_name: 'Ngân hàng BIDV', short_name: 'BIDV' },
    account_name: 'F120',
    account_number: '9631',
  };

  it('posts the lookup with the partner key from the environment', async () => {
    fetchMock.mockResolvedValue(reply(200, { data: verified }));

    await expect(client.verifyAccount('970418', '9631')).resolves.toEqual(verified);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://pay.example/api/v1/payment-methods/verify');
    expect(init.headers['Partner-App-Key']).toBe('secret-key');
    expect(JSON.parse(init.body)).toEqual({ account_number: '9631', bin_code: '970418' });
  });

  it.each([
    ['400500', 'BANK'],
    ['400501', 'ACCOUNT'],
  ])('maps error %s to BANK_ACCOUNT_INVALID (%s)', async (code, reason) => {
    fetchMock.mockResolvedValue(reply(400, { error_code: code, message: 'x' }));

    await expect(client.verifyAccount('970418', '1')).rejects.toMatchObject({
      status: 400,
      response: { code: 'BANK_ACCOUNT_INVALID', details: { reason } },
    });
  });

  it.each([
    ['a server error', () => Promise.resolve(reply(500, { error_code: '500001' }))],
    ['an unknown 4xx', () => Promise.resolve(reply(401, { error_code: '401000' }))],
    [
      'a non-JSON body',
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('html');
          },
        } as unknown as Response),
    ],
    ['a network failure', () => Promise.reject(new Error('ECONNRESET'))],
  ])('answers 503 on %s', async (_label, impl) => {
    fetchMock.mockImplementation(impl);
    await expect(client.verifyAccount('970418', '1')).rejects.toMatchObject({ status: 503 });
  });

  it('answers 503 without calling out when the key is not configured', async () => {
    env.HOLDSTATION_PARTNER_APP_KEY = undefined;
    await expect(client.listBanks()).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an empty holder name as an invalid account', async () => {
    fetchMock.mockResolvedValue(reply(200, { data: { ...verified, account_name: ' ' } }));
    await expect(client.verifyAccount('970418', '1')).rejects.toMatchObject({ status: 400 });
  });

  it('pages through the bank directory', async () => {
    const page = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ bin_code: `9${i}`, bank_name: 'B', short_name: 'S' }));
    fetchMock
      .mockResolvedValueOnce(reply(200, { data: { banks: page(200), total_count: 250 } }))
      .mockResolvedValueOnce(reply(200, { data: { banks: page(50), total_count: 250 } }));

    await expect(client.listBanks()).resolves.toHaveLength(250);
    expect(fetchMock.mock.calls[1][0]).toContain('page=2');
  });
});
