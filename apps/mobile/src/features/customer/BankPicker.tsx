import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { VnBank } from '@storage/types';
import { Button } from 'heroui-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { toAccountHolderName } from '../../../lib/settlement-format';

/** Rows shown at once; typing narrows the list rather than scrolling through all banks. */
const MAX_MATCHES = 6;

type Props = {
  banks: VnBank[];
  isLoading: boolean;
  /** The list could not be loaded; the customer can try again but not pick a bank. */
  failed: boolean;
  onRetry: () => void;
  mutedColor: string;
  onPickBank: (bank: VnBank) => void;
};

/** Search over the server's bank directory by name or BIN. */
export function BankPicker({ banks, isLoading, failed, onRetry, mutedColor, onPickBank }: Props) {
  const [query, setQuery] = useState('');
  const index = useMemo(
    () =>
      banks.map((bank) => ({
        bank,
        // Same folding as account names: no diacritics, upper case — "vietcom" finds "Vietcombank".
        text: toAccountHolderName(`${bank.shortName} ${bank.name} ${bank.bin}`),
      })),
    [banks],
  );
  const matches = useMemo(() => {
    const needle = toAccountHolderName(query);
    return index
      .filter((entry) => !needle || entry.text.includes(needle))
      .slice(0, MAX_MATCHES)
      .map((entry) => entry.bank);
  }, [index, query]);

  if (isLoading) {
    return (
      <View className="items-center rounded-lg border border-border px-3 py-4">
        <ActivityIndicator color={mutedColor} />
      </View>
    );
  }
  if (failed) {
    return (
      <View className="gap-2 rounded-lg border border-border px-3 py-3">
        <Text className="font-body text-body-sm text-danger">
          Không tải được danh sách ngân hàng, vui lòng thử lại
        </Text>
        <Button size="sm" variant="secondary" onPress={onRetry}>
          <Button.Label className="font-ui">Thử lại</Button.Label>
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <BottomSheetTextInput
        className="font-body rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-body-sm text-foreground"
        placeholder="Tìm ngân hàng theo tên hoặc mã BIN"
        placeholderTextColor={mutedColor}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <View className="overflow-hidden rounded-lg border border-border">
        {matches.map((bank) => (
          <Pressable
            key={bank.bin}
            accessibilityRole="button"
            className="border-b border-separator px-3 py-2.5"
            onPress={() => onPickBank(bank)}
          >
            <Text className="font-strong text-body-sm text-foreground">{bank.shortName}</Text>
            <Text className="font-body text-caption text-muted" numberOfLines={1}>
              {bank.name} · {bank.bin}
            </Text>
          </Pressable>
        ))}
        {matches.length === 0 ? (
          <Text className="font-body px-3 py-2.5 text-body-sm text-muted">
            Không thấy ngân hàng phù hợp.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
