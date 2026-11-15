import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { View } from 'react-native';
import { Button, colors, InlineMessage, Text } from '../../components/ui';
import { BankPicker } from './BankPicker';
import {
  EMPTY_REFUND_ACCOUNT,
  type RefundAccountDraft,
  verifiedAccount,
} from './refund-account-draft';
import { useBankVerification } from './use-bank-verification';
import { useBanks } from './use-banks';

const INPUT_CLASS =
  'rounded-xl border border-border-default bg-bg-subtle px-3.5 py-3 font-inter text-body text-text-primary';

type Props = {
  draft: RefundAccountDraft;
  onChange: (draft: RefundAccountDraft) => void;
  required: boolean;
  /** Shown under the title, e.g. what leaving the form empty does. */
  hint?: string | null;
  mutedColor?: string;
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
  const placeholderColor = mutedColor ?? colors.semantic.textPlaceholder;

  return (
    <View className="gap-2.5">
      <Text className="text-body-sm font-semibold text-text-primary">
        Tài khoản nhận hoàn cọc{required ? '' : ' (không bắt buộc)'}
      </Text>
      {hint ? <Text className="text-caption text-text-secondary">{hint}</Text> : null}
      {draft.bankBin !== null ? (
        <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-card px-3.5 py-2.5">
          <Text className="flex-1 text-body-sm font-semibold text-text-primary" numberOfLines={1}>
            {draft.bankName}
          </Text>
          <Button
            label="Đổi"
            onPress={() => onChange({ ...draft, bankBin: null, bankName: '', verified: null })}
            size="sm"
            variant="secondary"
          />
        </View>
      ) : (
        <BankPicker
          {...bankList}
          mutedColor={placeholderColor}
          onRetry={bankList.retry}
          onPickBank={(bank) =>
            onChange({ ...draft, bankBin: bank.bin, bankName: bank.shortName, verified: null })
          }
        />
      )}
      <BottomSheetTextInput
        className={INPUT_CLASS}
        placeholder="Số tài khoản"
        placeholderTextColor={placeholderColor}
        value={draft.accountNo}
        onChangeText={(accountNo) => onChange({ ...draft, accountNo, verified: null })}
        onEndEditing={() => void check.verify()}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={40}
      />
      {holder ? (
        <View className="gap-0.5 rounded-xl border border-border-default bg-bg-subtle px-3.5 py-2.5">
          <Text className="text-caption text-text-secondary">Chủ tài khoản</Text>
          <Text className="text-body-sm font-semibold text-text-primary">{holder}</Text>
        </View>
      ) : (
        <Button
          disabled={!check.canVerify}
          label={check.isChecking ? 'Đang kiểm tra…' : 'Kiểm tra tài khoản'}
          loading={check.isChecking}
          onPress={() => void check.verify()}
          size="sm"
          variant="secondary"
        />
      )}
      {check.error ? <InlineMessage message={check.error} type="error" /> : null}
      {!required && draft.bankBin !== null ? (
        <Button
          label="Bỏ tài khoản"
          onPress={() => onChange(EMPTY_REFUND_ACCOUNT)}
          size="sm"
          variant="text"
        />
      ) : null}
    </View>
  );
}
