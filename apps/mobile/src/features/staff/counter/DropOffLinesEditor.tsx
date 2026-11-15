import type { ShelfItemUnit, ShelfItemView } from '@storage/types';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  addNewItem,
  addTopUp,
  MAX_ITEM_NAME,
  type ReceiptDraft,
  removeLine,
  setQuantity,
  setUnit,
} from '../../../../lib/shelf-receipt-draft';
import { DEFAULT_UNIT, quantityWithUnit, unitLabel } from '../../../../lib/shelf-storage-format';
import { UnitPicker } from '../../../components/UnitPicker';
import { Button, DashedDivider, Input, Text } from '../../../components/ui';
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
  const [unit, setNewUnit] = useState<ShelfItemUnit>(DEFAULT_UNIT);
  const add = () => {
    if (!name.trim()) return;
    onChange(addNewItem(draft, name, unit));
    setName('');
    setNewUnit(DEFAULT_UNIT);
  };
  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-body font-semibold text-text-primary">Danh sách món đồ nhận</Text>

      {existing.length > 0 ? (
        <View className="gap-2">
          <Text className="text-caption text-text-secondary">Đồ đã có trên kệ, chạm để thêm</Text>
          <View className="flex-row flex-wrap gap-2">
            {existing.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                className="rounded-full border border-border-default bg-bg-subtle px-3.5 py-1.5"
                onPress={() => onChange(addTopUp(draft, item))}
                style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
              >
                <Text className="text-caption font-medium text-text-primary">
                  + {item.name} ({quantityWithUnit(item.quantity, item.unit)})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View className="flex-row items-center gap-2">
        <Input
          accessibilityLabel="Tên món đồ mới"
          clearable
          containerClassName="flex-1"
          maxLength={MAX_ITEM_NAME}
          onChangeText={setName}
          onSubmitEditing={add}
          placeholder="Tên món đồ mới"
          value={name}
        />
        <Button disabled={!name.trim()} label="Thêm" onPress={add} size="sm" variant="secondary" />
      </View>
      <UnitPicker label="Đơn vị món mới" value={unit} onChange={setNewUnit} />

      {draft.lines.length > 0 ? <DashedDivider /> : null}

      {draft.lines.map((line) => (
        <View key={line.key} className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-body-lg text-text-primary">
              {line.name}
              {line.itemId ? ` · ${unitLabel(line.unit)}` : ''}
            </Text>
            {line.itemId ? null : (
              <UnitPicker
                value={line.unit}
                onChange={(next) => onChange(setUnit(draft, line.key, next))}
              />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(removeLine(draft, line.key))}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-caption font-medium text-status-danger">Bỏ dòng</Text>
            </Pressable>
          </View>
          <QuantityStepper
            onChange={(quantity) => onChange(setQuantity(draft, line.key, quantity))}
            value={line.quantity}
          />
        </View>
      ))}
    </View>
  );
}
