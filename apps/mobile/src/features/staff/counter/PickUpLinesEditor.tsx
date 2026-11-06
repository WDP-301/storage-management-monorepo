import { Text, View } from 'react-native';
import { type ReceiptDraft, setQuantity } from '../../../../lib/shelf-receipt-draft';
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
      <Text className="rounded-xl bg-surface-secondary p-3 font-body text-body-sm text-muted">
        Kệ đang trống, không có đồ để trả.
      </Text>
    );
  }
  return (
    <View className="gap-2.5">
      {draft.lines.map((line) => (
        <View key={line.key} className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-body text-body-md text-foreground">{line.name}</Text>
            <Text className="font-body text-caption text-muted">Trên kệ: {line.max}</Text>
          </View>
          <QuantityStepper
            value={line.quantity}
            max={line.max}
            onChange={(quantity) => onChange(setQuantity(draft, line.key, quantity))}
          />
        </View>
      ))}
    </View>
  );
}
