import type { ShelfReceiptView } from '@storage/types';
import { Button } from 'heroui-native';
import { Pressable, Text } from 'react-native';
import { canReportReceipt } from '../../lib/receipt-dispute';
import { TICKET_STATUS_LABEL } from '../features/customer/ticket-display';

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
        disabled={!onOpenDispute}
        className="rounded-lg bg-warning-bg px-2.5 py-2"
        onPress={() => onOpenDispute?.(dispute.id)}
      >
        <Text className="font-strong text-body-sm text-warning">{label}</Text>
      </Pressable>
    );
  }
  if (!onReport || !canReportReceipt(receipt)) return null;
  return (
    <Button size="sm" variant="secondary" onPress={onReport}>
      <Button.Label>Báo sai phiếu</Button.Label>
    </Button>
  );
}
