import { useLocalSearchParams } from 'expo-router';
import { ShelfReceiptDetailScreen } from '../../src/features/staff/counter/ShelfReceiptDetailScreen';

export default function ShelfReceiptRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShelfReceiptDetailScreen key={id} receiptId={id} />;
}
