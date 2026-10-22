import { Button, Input } from '@cloudflare/kumo';
import { SignOut, WarningCircle } from '@phosphor-icons/react';
import type React from 'react';
import { useState } from 'react';
import { ContractsApi } from '../../lib/api';
import { addDays, vnNoonIso, vnToday } from '../../lib/vn-day';
import type { ContractRecord } from '../../types/contract';
import type { ManagedReturnRequestInput } from '../../types/settlement';
import { RefundBankAccountFields } from './RefundBankAccountFields';
import {
  type BankFormState,
  currentVerification,
  EMPTY_BANK_FORM,
  toBankAccountInput,
  validateBankForm,
} from './refund-account-form';
import { describeApiError } from './settlement-display';
import { MAX_NOTE_LENGTH } from './settlement-form';

const MAX_DAYS_AHEAD = 365;
type Source = ManagedReturnRequestInput['source'];

interface Props {
  contract: ContractRecord;
  /** Facility managers (own facility), operations and admin; the API checks the facility. */
  canRequest: boolean;
  onChanged: () => void;
}

/** A return request the branch opens for a customer who phoned in or abandoned the unit. */
export const ManagedReturnForm: React.FC<Props> = ({ contract, canRequest, onChanged }) => {
  const today = vnToday();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  const [source, setSource] = useState<Source>('HOTLINE');
  const [note, setNote] = useState('');
  const [withAccount, setWithAccount] = useState(false);
  const [bank, setBank] = useState<BankFormState>(EMPTY_BANK_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openReturn = contract.return && !contract.return.finalized_at;
  if (!canRequest || contract.status !== 'ACTIVE' || openReturn) return null;
  const lastDay = addDays(today, MAX_DAYS_AHEAD);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem =
      !day || day < today || day > lastDay
        ? 'Ngày hẹn trả phải từ hôm nay đến 365 ngày tới.'
        : note.trim().length > MAX_NOTE_LENGTH
          ? `Ghi chú tối đa ${MAX_NOTE_LENGTH} ký tự.`
          : withAccount
            ? validateBankForm(bank)
            : null;
    if (problem) return setError(problem);
    const input: ManagedReturnRequestInput = { scheduledAt: vnNoonIso(day), source };
    if (note.trim()) input.note = note.trim();
    if (withAccount) input.refundAccount = toBankAccountInput(bank);
    setBusy(true);
    setError(null);
    try {
      await ContractsApi.createReturnOnBehalf(contract.id, input);
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(describeApiError(err, 'Không tạo được yêu cầu trả kho.'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="secondary"
          icon={<SignOut className="w-3.5 h-3.5" />}
          onClick={() => setOpen(true)}
        >
          Tạo yêu cầu trả kho thay khách
        </Button>
      </div>
    );
  }

  return (
    <form className="p-3 rounded-lg ring ring-kumo-line space-y-3" onSubmit={submit} noValidate>
      <span className="text-xs font-semibold text-kumo-default block">
        Yêu cầu trả kho thay khách
      </span>
      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          label="Ngày hẹn trả"
          type="date"
          min={today}
          max={lastDay}
          value={day}
          disabled={busy}
          onChange={(e) => setDay(e.target.value)}
        />
        <fieldset className="grid gap-1 text-sm text-kumo-default">
          <legend className="text-xs font-medium mb-1">Nguồn yêu cầu</legend>
          {(
            [
              ['HOTLINE', 'Khách gọi hotline'],
              ['ABANDONED', 'Khách bỏ kho'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="managed-return-source"
                checked={source === value}
                disabled={busy}
                onChange={() => setSource(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </div>
      <Input
        label="Ghi chú (tuỳ chọn)"
        value={note}
        maxLength={MAX_NOTE_LENGTH}
        disabled={busy}
        onChange={(e) => setNote(e.target.value)}
      />
      <label className="inline-flex items-center gap-1.5 text-sm text-kumo-default cursor-pointer">
        <input
          type="checkbox"
          checked={withAccount}
          disabled={busy}
          onChange={(e) => setWithAccount(e.target.checked)}
        />
        Nhập tài khoản nhận hoàn cọc (tuỳ chọn, phải kiểm tra tại ngân hàng)
      </label>
      {withAccount && <RefundBankAccountFields value={bank} onChange={setBank} disabled={busy} />}
      {error && (
        <div
          role="alert"
          className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex gap-2"
        >
          <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Đóng
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={busy}
          disabled={withAccount && !currentVerification(bank)}
        >
          Tạo yêu cầu trả kho
        </Button>
      </div>
    </form>
  );
};
