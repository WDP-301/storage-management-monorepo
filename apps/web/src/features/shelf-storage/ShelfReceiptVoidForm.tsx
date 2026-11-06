import { Button, InputArea } from '@cloudflare/kumo';
import type { ShelfReceiptView } from '@storage/types';
import type React from 'react';
import { useState } from 'react';
import { ShelfStorageApi } from '../../lib/shelf-storage-api';
import { useAppToast } from '../../lib/toast';
import { describeVoidError, VOID_REASON_MAX, VOID_REASON_MIN } from './shelf-records-display';

/** Voiding reverses the stock, so the reason is mandatory and the server still re-checks everything. */
export const ShelfReceiptVoidForm: React.FC<{
  receipt: ShelfReceiptView;
  onVoided: () => void;
}> = ({ receipt, onVoided }) => {
  const toast = useAppToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = reason.trim();
  const valid = trimmed.length >= VOID_REASON_MIN && trimmed.length <= VOID_REASON_MAX;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await ShelfStorageApi.voidReceipt(receipt.id, { reason: trimmed });
      toast.success('Đã hủy phiếu', `Phiếu ${receipt.code} đã hủy, số đồ trên kệ đã cập nhật lại.`);
      onVoided();
    } catch (err) {
      setError(describeVoidError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2 p-4 rounded-lg ring ring-kumo-line">
      <InputArea
        label="Lý do hủy phiếu"
        value={reason}
        minRows={2}
        maxLength={VOID_REASON_MAX}
        disabled={busy}
        description={`Từ ${VOID_REASON_MIN} đến ${VOID_REASON_MAX} ký tự; khách sẽ nhận được thông báo.`}
        onChange={(e) => setReason(e.target.value)}
      />
      {error && (
        <div role="alert" className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="destructive" size="sm" disabled={!valid} loading={busy} onClick={submit}>
          Hủy phiếu
        </Button>
      </div>
    </section>
  );
};
