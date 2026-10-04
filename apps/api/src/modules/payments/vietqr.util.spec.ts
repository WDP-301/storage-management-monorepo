import { buildVietQrUrl } from './vietqr.util';

describe('buildVietQrUrl', () => {
  it('embeds bank, account, amount and transfer content', () => {
    const url = buildVietQrUrl({
      bankId: 'MB',
      accountNo: '0123456789',
      accountName: 'CONG TY TNHH KHO',
      amount: '1000000',
      addInfo: 'BK-1790760804609-6618',
    });

    expect(url).toBe(
      'https://img.vietqr.io/image/MB-0123456789-compact2.png?amount=1000000&addInfo=BK-1790760804609-6618&accountName=CONG+TY+TNHH+KHO',
    );
  });
});
