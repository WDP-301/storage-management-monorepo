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
  }>();
  return (
    <ShelfReceiptFormScreen
      // Remount per contract/type so a form never keeps the previous shelf's draft.
      key={`${params.contractId}:${params.type}:${params.requestId ?? ''}`}
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
