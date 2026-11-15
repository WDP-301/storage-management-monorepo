import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type { VnBank } from '@storage/types';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { toAccountHolderName } from '../../../lib/settlement-format';
import { Button, colors, InlineMessage, Text } from '../../components/ui';

/** Rows shown at once; typing narrows the list rather than scrolling through all banks. */
const MAX_MATCHES = 6;

type Props = {
  banks: VnBank[];
  isLoading: boolean;
  /** The list could not be loaded; the customer can try again but not pick a bank. */
  failed: boolean;
  onRetry: () => void;
  mutedColor?: string;
  onPickBank: (bank: VnBank) => void;
};

/** Search over the server's bank directory by name or BIN. */
export function BankPicker({ banks, isLoading, failed, onRetry, mutedColor, onPickBank }: Props) {
  const [query, setQuery] = useState('');
  const placeholderColor = mutedColor ?? colors.semantic.textPlaceholder;

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
      <View className="items-center rounded-xl border border-border-default bg-bg-subtle px-3 py-4">
        <ActivityIndicator color={colors.semantic.actionPrimary} />
      </View>
    );
  }
  if (failed) {
    return (
      <View className="gap-2 rounded-xl border border-border-default bg-bg-card p-3">
        <InlineMessage
          message="Không tải được danh sách ngân hàng, vui lòng thử lại"
          type="error"
        />
        <Button label="Thử lại" onPress={onRetry} size="sm" variant="secondary" />
      </View>
    );
  }

  return (
    <View className="gap-2">
      <BottomSheetTextInput
        className="rounded-xl border border-border-default bg-bg-subtle px-3.5 py-2.5 font-inter text-body text-text-primary"
        placeholder="Tìm ngân hàng theo tên hoặc mã BIN"
        placeholderTextColor={placeholderColor}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
      />
      <View className="overflow-hidden rounded-xl border border-border-default bg-bg-card">
        {matches.map((bank) => (
          <Pressable
            key={bank.bin}
            accessibilityRole="button"
            className="border-b border-border-divider px-3.5 py-2.5"
            onPress={() => onPickBank(bank)}
          >
            <Text className="text-body-sm font-semibold text-text-primary">{bank.shortName}</Text>
            <Text className="text-caption text-text-secondary" numberOfLines={1}>
              {bank.name} · {bank.bin}
            </Text>
          </Pressable>
        ))}
        {matches.length === 0 ? (
          <Text className="px-3.5 py-2.5 text-body-sm text-text-secondary">
            Không thấy ngân hàng phù hợp.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
