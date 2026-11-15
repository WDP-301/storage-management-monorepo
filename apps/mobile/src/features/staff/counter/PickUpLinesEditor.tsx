import { View } from 'react-native';
import { type ReceiptDraft, setQuantity } from '../../../../lib/shelf-receipt-draft';
import { quantityWithUnit } from '../../../../lib/shelf-storage-format';
import { Text } from '../../../components/ui';
import { QuantityStepper } from './QuantityStepper';

/** One stepper per item on the shelf (0 up to what is there); only items with a quantity are handed back. */
export function PickUpLinesEditor({
  draft,
  onChange,
}: {
  draft: ReceiptDraft;
  onChange: (draft: ReceiptDraft) => void;
}) {
  if (draft.lines.length === 0) {
    return (
      <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
        <Text className="text-body text-text-secondary">Kệ đang trống, không có đồ để trả.</Text>
      </View>
    );
  }
  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-body font-semibold text-text-primary">Món đồ trả khách</Text>
      {draft.lines.map((line) => (
        <View key={line.key} className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-body-lg text-text-primary">{line.name}</Text>
            <Text className="text-caption text-text-secondary">
              Trên kệ: {quantityWithUnit(line.max ?? 0, line.unit)}
            </Text>
          </View>
          <QuantityStepper
            max={line.max}
            onChange={(quantity) => onChange(setQuantity(draft, line.key, quantity))}
            value={line.quantity}
          />
        </View>
      ))}
    </View>
  );
}
