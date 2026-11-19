import { Button, Dialog, Text, Textarea } from '@cloudflare/kumo';
import { ArrowsClockwise, WarningCircle, X } from '@phosphor-icons/react';
import type { ContractRenewalView } from '@storage/types';
import React, { useState } from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { ContractRenewalsApi } from '../../lib/contract-renewals-api';
import { formatVnDay, lastDayBefore } from '../../lib/vn-day';
import { shortContractNo } from '../contracts/contract-display';
import { formatVnd } from '../warehouses/warehouse-display';

interface Props {
  renewal: ContractRenewalView;
  action: 'approve' | 'reject';
  onClose: () => void;
  onDecided: (renewal: ContractRenewalView) => void;
}

/** Approve (optional note) or reject (reason shown to the customer) one pending renewal. */
export const RenewalDecisionDialog: React.FC<Props> = ({ renewal, action, onClose, onDecided }) => {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approving = action === 'approve';

  const submit = async () => {
    if (!approving && !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = approving
        ? await ContractRenewalsApi.approve(renewal.id, note)
        : await ContractRenewalsApi.reject(renewal.id, note);
      onDecided(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được quyết định.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog size="lg" className={`${DIALOG_SHELL} max-w-xl sm:w-[560px] w-full`}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <ArrowsClockwise className="w-5 h-5 text-kumo-brand" />
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              {approving ? 'Duyệt gia hạn' : 'Từ chối gia hạn'} —{' '}
              {shortContractNo(renewal.contract_no)}
            </Dialog.Title>
          </div>
          <Dialog.Close
            render={
              <Button
                size="sm"
                variant="ghost"
                shape="square"
                icon={<X weight="bold" />}
                aria-label="Đóng"
              />
            }
          />
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-1 text-sm">
            <div className="text-kumo-default">
              {renewal.customer?.full_name ?? '—'} · kho {renewal.unit_code ?? '—'}
            </div>
            <div className="text-kumo-subtle">
              Thêm {renewal.months} tháng, giữ giá {formatVnd(renewal.monthly_price)}/tháng
            </div>
            <div className="text-kumo-subtle">
              Hết hạn: {formatVnDay(lastDayBefore(renewal.term_end_at))} →{' '}
              <span className="text-kumo-default font-medium">
                {formatVnDay(lastDayBefore(renewal.new_term_end_at))}
              </span>
            </div>
            {renewal.note && (
              <div className="text-kumo-subtle">Ghi chú của khách: {renewal.note}</div>
            )}
          </div>
          {approving && (
            <Text variant="secondary" size="sm">
              Hợp đồng được cộng thêm số tháng; hóa đơn các tháng mới phát hành hằng tháng như cũ.
              Trả kho trước ngày hết hạn mới là trả trước hạn.
            </Text>
          )}
          <Textarea
            label={approving ? 'Ghi chú' : 'Lý do từ chối (khách sẽ thấy)'}
            required={!approving}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full min-w-0 resize-y"
          />
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-kumo-danger-tint text-kumo-danger text-sm">
              <WarningCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!approving && !note.trim()}
            onClick={submit}
          >
            {approving ? 'Duyệt gia hạn' : 'Từ chối'}
          </Button>
        </DialogFooter>
      </Dialog>
    </Dialog.Root>
  );
};
