import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { VN_BANKS, type VnBank } from '@storage/types';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { toAccountHolderName } from '../../../lib/settlement-format';

/** Rows shown at once; typing narrows the list rather than scrolling through all banks. */
const MAX_MATCHES = 6;

const SEARCH_INDEX = VN_BANKS.map((bank) => ({
  bank,
  // Same folding as account names: no diacritics, upper case — "vietcom" finds "Vietcombank".
  text: toAccountHolderName(`${bank.shortName} ${bank.name} ${bank.bin}`),
}));

type Props = {
  mutedColor: string;
  onPickBank: (bank: VnBank) => void;
  onPickOther: () => void;
};

/** Search over the VietQR bank directory by name or BIN, plus "other" for an unlisted bank. */
export function BankPicker({ mutedColor, onPickBank, onPickOther }: Props) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const needle = toAccountHolderName(query);
    return SEARCH_INDEX.filter((entry) => !needle || entry.text.includes(needle))
      .slice(0, MAX_MATCHES)
      .map((entry) => entry.bank);
  }, [query]);

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
        <Pressable accessibilityRole="button" className="px-3 py-2.5" onPress={onPickOther}>
          <Text className="font-ui text-body-sm text-accent">Ngân hàng khác (nhập tên)</Text>
        </Pressable>
      </View>
    </View>
  );
}
