import { Button, Input } from '@cloudflare/kumo';
import { Trash, UploadSimple, WarningCircle } from '@phosphor-icons/react';
import { type ContractInvoiceRecord, type EvidenceFile, ManualPaymentMethod } from '@storage/types';
import type React from 'react';
import { useRef, useState } from 'react';
import { SignedFileLink, SignedImageThumb } from '../../components/SignedFile';
import { UploadsApi } from '../../lib/api';
import { InvoicesApi } from '../../lib/invoices-api';
import { vnToday } from '../../lib/vn-day';
import { formatVnd } from '../warehouses/warehouse-display';
import { ACCEPTED_DOCUMENT_TYPES } from './contract-display';
import { isStalePaymentError } from './invoice-display';
import {
  buildPaymentInput,
  initialPaymentForm,
  MAX_PAYMENT_EVIDENCE,
  MAX_PAYMENT_NOTE_LENGTH,
  MAX_PAYMENT_REF_LENGTH,
  validatePaymentForm,
} from './invoice-payment-form';
import { validateProofFiles } from './refund-proof-form';
import { describeApiError } from './settlement-display';

interface Props {
  contractId: string;
  /** ISSUED or PARTIALLY_PAID invoice. */
  invoice: ContractInvoiceRecord;
  onRecorded: (invoice: ContractInvoiceRecord) => void;
  /** The invoice changed under us (paid meanwhile, voided): reload the list. */
  onStale: () => void;
  onCancel: () => void;
}

const METHODS = [
  [ManualPaymentMethod.BANK_TRANSFER, 'Chuyển khoản'],
  [ManualPaymentMethod.CASH, 'Tiền mặt'],
] as const;

/** Records money SePay could not match: amount, day, transfer proof and a required note. */
export const InvoicePaymentForm: React.FC<Props> = ({
  contractId,
  invoice,
  onRecorded,
  onStale,
  onCancel,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [today] = useState(vnToday);
  const [form, setForm] = useState(() => initialPaymentForm(invoice.amount_due, today));
  const [busy, setBusy] = useState<'upload' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isTransfer = form.method === ManualPaymentMethod.BANK_TRANSFER;

  const upload = async (files: File[]) => {
    const problem = validateProofFiles(form.evidence.length, files);
    if (problem) return setError(problem);
    setBusy('upload');
    setError(null);
    try {
      const added: EvidenceFile[] = [];
      // One at a time: a failure stops early and keeps what was already uploaded.
      for (const file of files) added.push(await UploadsApi.upload(file));
      setForm((prev) => ({ ...prev, evidence: [...prev.evidence, ...added] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải ảnh giao dịch lên thất bại.');
    } finally {
      setBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const problem = validatePaymentForm(form, invoice.amount_due, today);
    if (problem) return setError(problem);
    setBusy('submit');
    setError(null);
    try {
      onRecorded(
        await InvoicesApi.recordPayment(contractId, invoice.id, buildPaymentInput(form, today)),
      );
    } catch (err) {
      setError(describeApiError(err, 'Không ghi nhận được thanh toán.'));
      if (isStalePaymentError(err)) onStale();
    } finally {
      setBusy(null);
    }
  };

  return (
    <form
      className="p-3 rounded-lg ring ring-kumo-line space-y-3"
      onSubmit={(e) => void submit(e)}
      noValidate
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-kumo-default">
          Ghi nhận thanh toán · {invoice.invoice_no}
        </span>
        <span className="text-xs text-kumo-subtle">
          Còn phải thu {formatVnd(invoice.amount_due)}
        </span>
      </div>

      <fieldset className="flex gap-4 text-sm text-kumo-default">
        <legend className="sr-only">Phương thức</legend>
        {METHODS.map(([value, label]) => (
          <label key={value} className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name={`payment-method-${invoice.id}`}
              checked={form.method === value}
              disabled={busy !== null}
              onChange={() => setForm((prev) => ({ ...prev, method: value }))}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          label="Số tiền (VND)"
          inputMode="numeric"
          value={form.amount}
          disabled={busy !== null}
          onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
        />
        <Input
          label="Ngày nhận tiền"
          type="date"
          max={today}
          value={form.paidOn}
          disabled={busy !== null}
          onChange={(e) => setForm((prev) => ({ ...prev, paidOn: e.target.value }))}
        />
        {isTransfer && (
          <Input
            label="Mã giao dịch ngân hàng"
            value={form.transferRef}
            maxLength={MAX_PAYMENT_REF_LENGTH}
            disabled={busy !== null}
            onChange={(e) => setForm((prev) => ({ ...prev, transferRef: e.target.value }))}
          />
        )}
        <Input
          label="Ghi chú"
          placeholder="Ví dụ: khách ghi sai nội dung chuyển khoản"
          value={form.note}
          maxLength={MAX_PAYMENT_NOTE_LENGTH}
          disabled={busy !== null}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
        />
      </div>

      <section className="space-y-2">
        <span className="text-xs font-semibold text-kumo-default block">
          Ảnh giao dịch ({form.evidence.length}/{MAX_PAYMENT_EVIDENCE})
          {isTransfer ? '' : ' · tuỳ chọn'}
        </span>
        {form.evidence.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {form.evidence.map((file) => (
              <li key={file.fileKey} className="space-y-1">
                {file.mimeType.startsWith('image/') ? (
                  <SignedImageThumb file={file} />
                ) : (
                  <SignedFileLink file={file} />
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Trash className="w-3.5 h-3.5" />}
                  aria-label={`Bỏ ảnh ${file.name}`}
                  disabled={busy !== null}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      evidence: prev.evidence.filter((f) => f.fileKey !== file.fileKey),
                    }))
                  }
                >
                  Bỏ
                </Button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPTED_DOCUMENT_TYPES.join(',')}
          aria-label="Chọn ảnh giao dịch"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) void upload(files);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          icon={<UploadSimple className="w-3.5 h-3.5" />}
          loading={busy === 'upload'}
          disabled={busy !== null || form.evidence.length >= MAX_PAYMENT_EVIDENCE}
          onClick={() => fileInput.current?.click()}
        >
          Đính kèm ảnh giao dịch
        </Button>
      </section>

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
        <Button variant="secondary" disabled={busy !== null} onClick={onCancel}>
          Để sau
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={busy === 'submit'}
          disabled={busy !== null}
        >
          Xác nhận đã thu
        </Button>
      </div>
    </form>
  );
};
