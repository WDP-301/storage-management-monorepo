import { Button } from '@cloudflare/kumo';
import type React from 'react';
import { useState } from 'react';
import type { ServiceTicketRecord } from '../../types/service-tickets';
import { ShelfReceiptDetailDialog } from '../shelf-storage/ShelfReceiptDetailDialog';
import { RECEIPT_STATUS_LABEL, RECEIPT_TYPE_LABEL } from '../shelf-storage/shelf-records-display';

/** Links a ticket the customer filed about a shelf receipt to that receipt. */
export const TicketShelfReceiptCard: React.FC<{
  ticket: ServiceTicketRecord;
  /** Called after the receipt was voided from the dialog, so the ticket can be reloaded. */
  onChanged?: () => void;
}> = ({ ticket, onChanged }) => {
  const [open, setOpen] = useState(false);
  const receipt = ticket.shelf_receipt;
  if (!receipt) return null;

  return (
    <div className="flex items-center justify-between gap-3 p-4 bg-kumo-tint rounded-lg ring ring-kumo-line">
      <div className="space-y-0.5 min-w-0">
        <span className="text-xs text-kumo-subtle block font-medium">
          Phiếu gửi / lấy đồ liên quan:
        </span>
        <span className="text-sm font-semibold text-kumo-default block">
          {receipt.code} · {RECEIPT_TYPE_LABEL[receipt.type]} ·{' '}
          {RECEIPT_STATUS_LABEL[receipt.status]}
        </span>
      </div>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Xem phiếu
      </Button>
      <ShelfReceiptDetailDialog
        receiptId={open ? receipt.id : null}
        onClose={() => setOpen(false)}
        onChanged={onChanged}
      />
    </div>
  );
};
