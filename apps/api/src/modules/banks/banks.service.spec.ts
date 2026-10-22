import { BanksService } from './banks.service';

describe('BanksService', () => {
  let holdstation: { listBanks: jest.Mock; verifyAccount: jest.Mock };
  let service: BanksService;

  beforeEach(() => {
    holdstation = {
      listBanks: jest.fn().mockResolvedValue([
        { bin_code: '970436', bank_name: 'Ngoại Thương', short_name: 'Vietcombank' },
        { bin_code: '970418', bank_name: 'Đầu tư', short_name: 'BIDV' },
        { bin_code: '', bank_name: 'broken', short_name: '' },
      ]),
      verifyAccount: jest.fn().mockResolvedValue({
        bank: { bank_name: 'Ngân hàng Đầu tư', short_name: 'BIDV' },
        account_name: 'Nguyễn Văn Ạ',
        account_number: '9631',
      }),
    };
    service = new BanksService(holdstation as never);
  });

  it('lists usable banks sorted by short name and caches them', async () => {
    await expect(service.listBanks()).resolves.toEqual([
      { bin: '970418', shortName: 'BIDV', name: 'Đầu tư' },
      { bin: '970436', shortName: 'Vietcombank', name: 'Ngoại Thương' },
    ]);
    await service.listBanks();
    expect(holdstation.listBanks).toHaveBeenCalledTimes(1);
  });

  it('keeps serving the last directory when a refresh fails', async () => {
    jest.useFakeTimers();
    await service.listBanks();
    jest.advanceTimersByTime(7 * 60 * 60 * 1000);
    holdstation.listBanks.mockRejectedValueOnce(new Error('down'));

    await expect(service.listBanks()).resolves.toHaveLength(2);
    expect(holdstation.listBanks).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('does not cache an empty directory', async () => {
    holdstation.listBanks.mockResolvedValueOnce([]);
    await expect(service.listBanks()).resolves.toEqual([]);
    await expect(service.listBanks()).resolves.toHaveLength(2);
  });

  it('surfaces the outage when there is no directory yet', async () => {
    holdstation.listBanks.mockRejectedValueOnce(Object.assign(new Error('down'), { status: 503 }));
    await expect(service.listBanks()).rejects.toMatchObject({ status: 503 });
  });

  it('stores the bank short name and the holder name the bank reports', async () => {
    await expect(
      service.verifyAccount({ bankBin: ' 970418 ', accountNo: ' 9631 ' }),
    ).resolves.toEqual({
      bankBin: '970418',
      bankName: 'BIDV',
      accountNo: '9631',
      accountName: 'NGUYEN VAN A',
    });
    expect(holdstation.verifyAccount).toHaveBeenCalledWith('970418', '9631');
  });
});
