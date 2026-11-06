import { useLocalSearchParams } from 'expo-router';
import { ShelfReceiptFormScreen } from '../../src/features/staff/counter/ShelfReceiptFormScreen';

export default function ShelfReceiptFormRoute() {
  const params = useLocalSearchParams<{
    mode?: string;
    type?: string;
    sessionId?: string;
    contractId: string;
    requestId?: string;
    customerName?: string;
    nonce?: string;
  }>();
  return (
    <ShelfReceiptFormScreen
      // Remount per open (nonce) so a form never keeps a previous visit's draft or request id.
      key={`${params.contractId}:${params.type}:${params.requestId ?? ''}:${params.nonce ?? ''}`}
      params={{
        recovery: params.mode === 'RECOVERY',
        type: params.type === 'DROP_OFF' ? 'DROP_OFF' : 'PICK_UP',
        sessionId: params.sessionId,
        contractId: params.contractId,
        requestId: params.requestId,
        customerName: params.customerName,
      }}
    />
  );
}
