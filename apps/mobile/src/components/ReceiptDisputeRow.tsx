import type { ShelfReceiptView } from '@storage/types';
import { Pressable } from 'react-native';
import { canReportReceipt } from '../../lib/receipt-dispute';
import { TICKET_STATUS_LABEL } from '../features/customer/ticket-display';
import { Button, Text } from './ui';

/** Flag for a reported receipt (opens the ticket when a handler is given) or the report button. */
export function ReceiptDisputeRow({
  receipt,
  onReport,
  onOpenDispute,
}: {
  receipt: ShelfReceiptView;
  onReport?: () => void;
  onOpenDispute?: (ticketId: string) => void;
}) {
  const dispute = receipt.openDisputeTicket;
  if (dispute) {
    const label = `Đã báo sai · ${dispute.ticketNo} · ${TICKET_STATUS_LABEL[dispute.status] ?? dispute.status}`;
    return (
      <Pressable
        accessibilityRole={onOpenDispute ? 'button' : 'text'}
        className="rounded-xl bg-warning-0 px-3 py-2"
        disabled={!onOpenDispute}
        onPress={() => onOpenDispute?.(dispute.id)}
      >
        <Text className="text-body-sm font-semibold text-warning-700">{label}</Text>
      </Pressable>
    );
  }
  if (!onReport || !canReportReceipt(receipt)) return null;
  return <Button label="Báo sai phiếu" onPress={onReport} size="sm" variant="secondary" />;
}
