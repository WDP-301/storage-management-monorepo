import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import { Text, View } from 'react-native';
import { BankPicker } from './BankPicker';
import {
  EMPTY_REFUND_ACCOUNT,
  type RefundAccountDraft,
  verifiedAccount,
} from './refund-account-draft';
import { useBankVerification } from './use-bank-verification';
import { useBanks } from './use-banks';

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
 * Where the deposit is refunded. The bank confirms the number and names its holder; the form
 * cannot be sent before that. The full number only ever lives in this form; everywhere else the
 * app shows the server's masked copy.
 */
export function RefundAccountFields({ draft, onChange, required, hint, mutedColor }: Props) {
  const bankList = useBanks();
  const check = useBankVerification(draft, onChange);
  const holder = verifiedAccount(draft)?.accountName;

  return (
    <View className="gap-2">
      <Text className="text-body-sm font-strong text-foreground">
        Tài khoản nhận hoàn cọc{required ? '' : ' (không bắt buộc)'}
      </Text>
      {hint ? <Text className="font-body text-caption text-muted">{hint}</Text> : null}
      {draft.bankBin !== null ? (
        <View className="flex-row items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Text className="flex-1 font-strong text-body-sm text-foreground" numberOfLines={1}>
            {draft.bankName}
          </Text>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => onChange({ ...draft, bankBin: null, bankName: '', verified: null })}
          >
            <Button.Label className="font-ui">Đổi</Button.Label>
          </Button>
        </View>
      ) : (
        <BankPicker
          {...bankList}
          mutedColor={mutedColor}
          onRetry={bankList.retry}
          onPickBank={(bank) =>
            onChange({ ...draft, bankBin: bank.bin, bankName: bank.shortName, verified: null })
          }
        />
      )}
      <BottomSheetTextInput
        className={INPUT_CLASS}
        placeholder="Số tài khoản"
        placeholderTextColor={mutedColor}
        value={draft.accountNo}
        onChangeText={(accountNo) => onChange({ ...draft, accountNo, verified: null })}
        onEndEditing={() => void check.verify()}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
      />
      {holder ? (
        <View className="gap-0.5 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
          <Text className="font-body text-caption text-muted">Chủ tài khoản</Text>
          <Text className="font-strong text-body-sm text-foreground">{holder}</Text>
        </View>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          isDisabled={!check.canVerify}
          onPress={() => void check.verify()}
        >
          <Button.Label className="font-ui">
            {check.isChecking ? 'Đang kiểm tra…' : 'Kiểm tra tài khoản'}
          </Button.Label>
        </Button>
      )}
      {check.error ? (
        <Text className="font-body text-caption text-danger">{check.error}</Text>
      ) : null}
      {!required && draft.bankBin !== null ? (
        <Button size="sm" variant="ghost" onPress={() => onChange(EMPTY_REFUND_ACCOUNT)}>
          <Button.Label className="font-ui">Bỏ tài khoản</Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
