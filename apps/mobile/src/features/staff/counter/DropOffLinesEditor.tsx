import type { ShelfItemView } from '@storage/types';
import { Button } from 'heroui-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  addNewItem,
  addTopUp,
  MAX_ITEM_NAME,
  type ReceiptDraft,
  removeLine,
  setQuantity,
} from '../../../../lib/shelf-receipt-draft';
import { QuantityStepper } from './QuantityStepper';

/** Receiving goods: tap an item already on the shelf to add more, or type a new item. */
export function DropOffLinesEditor({
  draft,
  existing,
  onChange,
}: {
  draft: ReceiptDraft;
  existing: readonly ShelfItemView[];
  onChange: (draft: ReceiptDraft) => void;
}) {
  const [name, setName] = useState('');
  const add = () => {
    onChange(addNewItem(draft, name));
    setName('');
  };
  return (
    <View className="gap-3">
      {existing.length > 0 ? (
        <View className="gap-1.5">
          <Text className="font-ui text-body-sm text-muted">Đồ đã có trên kệ, chạm để thêm</Text>
          <View className="flex-row flex-wrap gap-2">
            {existing.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                className="rounded-full bg-surface-secondary px-3 py-2"
                onPress={() => onChange(addTopUp(draft, item))}
              >
                <Text className="font-ui text-body-sm text-foreground">
                  + {item.name} ({item.quantity})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <TextInput
          accessibilityLabel="Tên món đồ mới"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-3 font-body text-body-sm text-foreground"
          maxLength={MAX_ITEM_NAME}
          placeholder="Tên món đồ mới"
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
        />
        <Button size="sm" variant="secondary" isDisabled={!name.trim()} onPress={add}>
          <Button.Label>Thêm</Button.Label>
        </Button>
      </View>

      {draft.lines.map((line) => (
        <View key={line.key} className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-body text-body-md text-foreground">{line.name}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(removeLine(draft, line.key))}
            >
              <Text className="font-ui text-caption text-danger">Bỏ dòng</Text>
            </Pressable>
          </View>
          <QuantityStepper
            value={line.quantity}
            onChange={(quantity) => onChange(setQuantity(draft, line.key, quantity))}
          />
        </View>
      ))}
    </View>
  );
}
