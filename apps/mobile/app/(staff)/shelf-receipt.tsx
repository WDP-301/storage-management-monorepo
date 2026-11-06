import { useLocalSearchParams } from 'expo-router';
import { ShelfReceiptDetailScreen } from '../../src/features/staff/counter/ShelfReceiptDetailScreen';

export default function ShelfReceiptRoute() {
  const { id, nonce } = useLocalSearchParams<{ id: string; nonce?: string }>();
  return <ShelfReceiptDetailScreen key={`${id}:${nonce ?? ''}`} receiptId={id} />;
}
