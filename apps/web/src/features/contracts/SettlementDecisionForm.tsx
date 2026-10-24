import { Button, Input } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import type React from 'react';
import { useState } from 'react';
import type { ApiError } from '../../lib/api';
import { SettlementsApi } from '../../lib/settlements-api';
import type { SettlementDetailRecord } from '../../types/settlement';
import { RefundBankAccountFields } from './RefundBankAccountFields';
import { currentVerification, toAccountHolderName } from './refund-account-form';
import { SettlementLineDecisions } from './SettlementLineDecisions';
import { SettlementLinesTable } from './SettlementLinesTable';
import { approvalOutcome, describeApiError, isStaleSettlementError } from './settlement-display';
import {
  approvalProblems,
  buildApproveInput,
  buildDecisions,
  initSettlementForm,
  MAX_NOTE_LENGTH,
  MAX_REASON_LENGTH,
  needsOverrideReason,
  needsRefundAccount,
} from './settlement-form';
import { useSettlementPreview } from './use-settlement-preview';

interface Props {
  /** PENDING settlement as loaded when the dialog opened. */
  record: SettlementDetailRecord;
  onApproved: (record: SettlementDetailRecord) => void;
  /** The settlement moved on elsewhere (approved by someone else): load it again. */
  onStale: () => void;
}

/** Decisions on every line, server-computed figures, refund account, then approval. */
export const SettlementDecisionForm: React.FC<Props> = ({ record, onApproved, onStale }) => {
  const [form, setForm] = useState(() => initSettlementForm(record));
  const [problems, setProblems] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useSettlementPreview(
    record.contract.id,
    record,
    (latest) => buildDecisions(form, latest),
    onStale,
  );
  const current = preview.record;
  const refund = needsRefundAccount(current);
  const customerName = toAccountHolderName(current.contract.customer.full_name);
  const bankVerified = currentVerification(form.bank) !== null;
  const holder = toAccountHolderName(currentVerification(form.bank)?.accountName ?? '');
  const update = (next: typeof form) => {
    setForm(next);
    setProblems([]);
    setConfirming(false);
  };

  const askApproval = () => {
    const found = approvalProblems(form, current);
    setProblems(found);
    setError(null);
    if (found.length === 0) setConfirming(true);
  };

  const approve = async () => {
    setBusy(true);
    setError(null);
    try {
      onApproved(
        await SettlementsApi.approve(record.contract.id, buildApproveInput(form, current)),
      );
    } catch (err) {
      setError(describeApiError(err, 'Không duyệt được quyết toán.'));
      if ((err as ApiError).code === 'SETTLEMENT_CHANGED') preview.refresh();
      if (isStaleSettlementError(err)) onStale();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettlementLineDecisions record={current} form={form} onChange={update} disabled={busy} />

      <section className="space-y-1.5">
        <span className="text-xs font-semibold text-kumo-default block">
          Số liệu quyết toán (máy chủ tính)
        </span>
        <SettlementLinesTable
          lines={current.lines}
          totals={current.totals}
          stale={!preview.fresh}
        />
        {preview.error && (
          <div className="flex items-center justify-between gap-2 text-sm text-kumo-danger">
            <span role="alert">{preview.error}</span>
            <Button size="sm" variant="secondary" onClick={preview.refresh}>
              Tính lại
            </Button>
          </div>
        )}
      </section>

      {refund && (
        <section className="space-y-2">
          <span className="text-xs font-semibold text-kumo-default block">
            Tài khoản nhận tiền hoàn
          </span>
          <p className="text-xs text-kumo-subtle">{refundAccountHint(current)}</p>
          <RefundBankAccountFields
            value={form.bank}
            // Functional update: a bank lookup resolves seconds later, and the reviewer may have
            // edited other fields meanwhile.
            onChange={(bank) => {
              setForm((prev) => ({ ...prev, bank }));
              setProblems([]);
              setConfirming(false);
            }}
            disabled={busy}
          />
          {holder.length > 0 && customerName && holder !== customerName && (
            <p role="status" className="text-xs text-kumo-warning">
              Tên chủ tài khoản {holder} khác tên khách hàng {customerName}.
            </p>
          )}
          {needsOverrideReason(form, current) && (
            <Input
              label="Lý do đổi tài khoản"
              value={form.bankReason}
              maxLength={MAX_REASON_LENGTH}
              disabled={busy}
              onChange={(e) => update({ ...form, bankReason: e.target.value })}
            />
          )}
        </section>
      )}

      <Input
        label="Ghi chú duyệt (tuỳ chọn)"
        value={form.note}
        maxLength={MAX_NOTE_LENGTH}
        disabled={busy}
        onChange={(e) => update({ ...form, note: e.target.value })}
      />

      {(problems.length > 0 || error) && (
        <div
          role="alert"
          className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex gap-2"
        >
          <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <ul className="space-y-0.5">
            {error && <li>{error}</li>}
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {confirming && current.totals ? (
        <div className="p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
          <p className="text-kumo-default">
            {approvalOutcome(current.totals)} Số liệu được chốt và không sửa được sau khi duyệt.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              Quay lại
            </Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!preview.fresh}
              onClick={() => void approve()}
            >
              Xác nhận duyệt
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            variant="primary"
            disabled={busy || !preview.fresh || (refund && !bankVerified)}
            title={
              preview.fresh
                ? bankVerified || !refund
                  ? undefined
                  : 'Kiểm tra tài khoản nhận tiền hoàn trước'
                : 'Đang tính lại số liệu…'
            }
            onClick={askApproval}
          >
            Duyệt quyết toán
          </Button>
        </div>
      )}
    </div>
  );
};

/** Where the pre-filled refund account comes from, naming it so operations know whose it is. */
function refundAccountHint(record: SettlementDetailRecord): string {
  const account = record.customer_bank_account;
  if (!account) {
    return 'Khách chưa cung cấp tài khoản nhận tiền hoàn — liên hệ khách để lấy số tài khoản, nhập bên dưới và ghi lý do.';
  }
  const named = `${account.bankName} ${account.accountNo} — ${account.accountName}`;
  return record.customer_bank_account_source === 'SAVED'
    ? `Yêu cầu trả kho không kèm tài khoản — đã điền sẵn tài khoản khách đã dùng ở lần trả kho trước (ngân hàng đã xác nhận tên): ${named}.`
    : `Đã điền sẵn tài khoản khách cung cấp khi yêu cầu trả kho: ${named}.`;
}
