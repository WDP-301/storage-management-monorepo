import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { toAccountHolderName } from '../../../lib/settlement-format';
import { BankPicker } from './BankPicker';
import { EMPTY_REFUND_ACCOUNT, type RefundAccountDraft } from './refund-account-draft';

const INPUT_CLASS =
  'font-body rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-body-sm text-foreground';

type Props = {
  draft: RefundAccountDraft;
  onChange: (draft: RefundAccountDraft) => void;
  required: boolean;
  /** Shown under the title, e.g. what leaving the form empty does. */
  hint?: string | null;
  mutedColor: string;
};

/**
 * Where the deposit is refunded. The full number only ever lives in this form; everywhere else the
 * app shows the server's masked copy.
 */
export function RefundAccountFields({ draft, onChange, required, hint, mutedColor }: Props) {
  const update = (patch: Partial<RefundAccountDraft>) => onChange({ ...draft, ...patch });
  const hasBank = draft.bankBin !== null || draft.isOtherBank;

  return (
    <View className="gap-2">
      <Text className="text-body-sm font-strong text-foreground">
        Tài khoản nhận hoàn cọc{required ? '' : ' (không bắt buộc)'}
      </Text>
      {hint ? <Text className="font-body text-caption text-muted">{hint}</Text> : null}
      {hasBank ? (
        <View className="flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Text className="flex-1 font-strong text-body-sm text-foreground" numberOfLines={1}>
            {draft.isOtherBank ? 'Ngân hàng khác' : draft.bankName}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => update({ bankBin: null, bankName: '', isOtherBank: false })}
          >
            <Button.Label className="font-ui">Đổi</Button.Label>
          </Button>
        </View>
      ) : (
        <BankPicker
          mutedColor={mutedColor}
          onPickBank={(bank) =>
            update({ bankBin: bank.bin, bankName: bank.shortName, isOtherBank: false })
          }
          onPickOther={() => update({ bankBin: null, bankName: '', isOtherBank: true })}
        />
      )}
      {draft.isOtherBank ? (
        <BottomSheetTextInput
          className={INPUT_CLASS}
          placeholder="Tên ngân hàng"
          placeholderTextColor={mutedColor}
          value={draft.bankName}
          onChangeText={(bankName) => update({ bankName })}
          maxLength={100}
        />
      ) : null}
      <BottomSheetTextInput
        className={INPUT_CLASS}
        placeholder="Số tài khoản"
        placeholderTextColor={mutedColor}
        value={draft.accountNo}
        onChangeText={(accountNo) => update({ accountNo })}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
      />
      <BottomSheetTextInput
        className={INPUT_CLASS}
        placeholder="Tên chủ tài khoản (VD: NGUYEN VAN A)"
        placeholderTextColor={mutedColor}
        value={draft.accountName}
        onChangeText={(accountName) => update({ accountName })}
        // Banks print names without diacritics; folding on blur shows exactly what is sent.
        onEndEditing={() => update({ accountName: toAccountHolderName(draft.accountName) })}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={100}
      />
      {!required && hasBank ? (
        <Button size="sm" variant="ghost" onPress={() => onChange(EMPTY_REFUND_ACCOUNT)}>
          <Button.Label className="font-ui">Bỏ tài khoản</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
