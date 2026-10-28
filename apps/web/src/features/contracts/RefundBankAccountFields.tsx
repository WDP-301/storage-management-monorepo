import { Button, Input, Select } from '@cloudflare/kumo';
import { CheckCircle } from '@phosphor-icons/react';
import type { VnBank } from '@storage/types';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BanksApi } from '../../lib/banks-api';
import {
  type BankFormState,
  currentVerification,
  describeBankLookupError,
} from './refund-account-form';

interface Props {
  value: BankFormState;
  onChange: (next: BankFormState) => void;
  disabled?: boolean;
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();

/** Refund account entry: a bank from the server list, the number, and the holder the bank reports. */
export const RefundBankAccountFields: React.FC<Props> = ({ value, onChange, disabled }) => {
  const [banks, setBanks] = useState<VnBank[] | null>(null);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [checking, setChecking] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const loadBanks = useCallback(() => {
    setBanksError(null);
    BanksApi.list().then(setBanks, (err) => setBanksError(describeBankLookupError(err)));
  }, []);
  useEffect(loadBanks, [loadBanks]);

  const options = useMemo(() => {
    const term = normalize(search.trim());
    return (banks ?? []).filter(
      (bank) =>
        bank.bin === value.bankBin || normalize(`${bank.shortName} ${bank.name}`).includes(term),
    );
  }, [banks, search, value.bankBin]);

  const verified = currentVerification(value);
  const edit = (patch: Partial<BankFormState>) => {
    setVerifyError(null);
    onChange({ ...value, ...patch, verified: null });
  };

  const verify = async () => {
    setChecking(true);
    setVerifyError(null);
    const accountNo = value.accountNo.trim();
    try {
      const result = await BanksApi.verify(value.bankBin, accountNo);
      onChange({ ...value, accountNo, verified: result });
    } catch (err) {
      setVerifyError(describeBankLookupError(err));
    } finally {
      setChecking(false);
    }
  };

  const busy = disabled || checking;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Input
        label="Tìm ngân hàng"
        value={search}
        placeholder="Vietcombank, Techcombank…"
        disabled={busy || !banks}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Select
        label="Ngân hàng"
        aria-label="Ngân hàng nhận tiền"
        className="w-full"
        placeholder={banks ? 'Chọn ngân hàng' : 'Đang tải danh sách…'}
        value={value.bankBin || null}
        disabled={busy || !banks}
        onValueChange={(v) => edit({ bankBin: v ? String(v) : '' })}
        items={options.map((bank) => ({
          value: bank.bin,
          label: `${bank.shortName} - ${bank.name}`,
        }))}
        // The search can filter the chosen bank out of the list, so the trigger looks it up in full.
        renderValue={(bin) => banks?.find((bank) => bank.bin === bin)?.shortName ?? String(bin)}
      />
      {banksError && (
        <div className="sm:col-span-2 flex items-center justify-between gap-2 text-sm text-kumo-danger">
          <span role="alert">{banksError}</span>
          <Button size="sm" variant="secondary" onClick={loadBanks}>
            Tải lại
          </Button>
        </div>
      )}
      <div className="sm:col-span-2 flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Số tài khoản"
            value={value.accountNo}
            maxLength={30}
            inputMode="numeric"
            disabled={busy}
            onChange={(e) => edit({ accountNo: e.target.value })}
          />
        </div>
        <Button
          variant="secondary"
          loading={checking}
          disabled={disabled || !value.bankBin || value.accountNo.trim().length < 4}
          onClick={() => void verify()}
        >
          Kiểm tra
        </Button>
      </div>
      {verifyError && (
        <p role="alert" className="sm:col-span-2 text-sm text-kumo-danger">
          {verifyError}
        </p>
      )}
      <div className="sm:col-span-2">
        <Input
          label="Tên chủ tài khoản (theo ngân hàng)"
          value={verified?.accountName ?? ''}
          readOnly
          disabled={disabled}
          placeholder="Bấm Kiểm tra để lấy tên chủ tài khoản"
        />
        {verified && (
          <p className="mt-1 flex items-center gap-1 text-xs text-kumo-success">
            <CheckCircle className="w-3.5 h-3.5" /> Đã xác thực tại {verified.bankName}
          </p>
        )}
      </div>
    </div>
  );
};
