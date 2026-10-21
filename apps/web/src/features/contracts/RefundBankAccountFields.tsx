import { Input } from '@cloudflare/kumo';
import { VN_BANKS } from '@storage/types';
import type React from 'react';
import { type BankFormState, OTHER_BANK } from './refund-account-form';

interface Props {
  value: BankFormState;
  onChange: (next: BankFormState) => void;
  disabled?: boolean;
}

/** Refund account entry: a VietQR bank from the list (or "other" typed by name), number, holder. */
export const RefundBankAccountFields: React.FC<Props> = ({ value, onChange, disabled }) => {
  const set = (patch: Partial<BankFormState>) => onChange({ ...value, ...patch });
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="grid gap-1 text-sm text-kumo-default sm:col-span-2">
        <span className="text-xs font-medium">Ngân hàng</span>
        <select
          aria-label="Ngân hàng nhận tiền"
          value={value.bankBin}
          disabled={disabled}
          onChange={(e) => set({ bankBin: e.target.value })}
          className="h-9 px-3 text-sm bg-kumo-base border border-kumo-line rounded-lg"
        >
          <option value="">-- Chọn ngân hàng --</option>
          {VN_BANKS.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.shortName} — {bank.name}
            </option>
          ))}
          <option value={OTHER_BANK}>Khác (nhập tên ngân hàng)</option>
        </select>
      </label>
      {value.bankBin === OTHER_BANK && (
        <div className="sm:col-span-2">
          <Input
            label="Tên ngân hàng"
            value={value.bankName}
            maxLength={100}
            disabled={disabled}
            onChange={(e) => set({ bankName: e.target.value })}
          />
        </div>
      )}
      <Input
        label="Số tài khoản"
        value={value.accountNo}
        maxLength={30}
        inputMode="numeric"
        disabled={disabled}
        onChange={(e) => set({ accountNo: e.target.value })}
      />
      <Input
        label="Tên chủ tài khoản"
        value={value.accountName}
        maxLength={100}
        placeholder="NGUYEN VAN A"
        disabled={disabled}
        onChange={(e) => set({ accountName: e.target.value })}
      />
    </div>
  );
};
