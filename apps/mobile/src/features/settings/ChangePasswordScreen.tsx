import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { AccountApi } from '../../../lib/account-api';
import {
  mapAccountError,
  type PasswordFieldErrors,
  type PasswordFormValues,
  toChangePasswordPayload,
  validatePasswordForm,
} from '../../../lib/account-form';
import { Button, FlowScreen, InlineMessage, Input, Text } from '../../components/ui';

type Props = {
  onBack: () => void;
};

const EMPTY_FORM: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function ChangePasswordScreen({ onBack }: Props) {
  const [values, setValues] = useState<PasswordFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useFocusEffect(
    useCallback(() => {
      setValues(EMPTY_FORM);
      setFieldErrors({});
      setSubmitError(null);
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBackRef.current();
        return true;
      });
      return () => {
        sub.remove();
        setValues(EMPTY_FORM);
        setFieldErrors({});
        setSubmitError(null);
      };
    }, []),
  );

  const setField = (field: keyof PasswordFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
  };

  const submit = async () => {
    if (isSubmitting) return;
    const errors = validatePasswordForm(values);
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await AccountApi.changePassword(toChangePasswordPayload(values));
      Alert.alert(
        'Đổi mật khẩu thành công',
        'Mật khẩu mới đã được áp dụng. Các phiên đăng nhập trên thiết bị khác đã được đăng xuất.',
        [{ text: 'Đóng', onPress: onBack }],
      );
    } catch (error) {
      const mapped = mapAccountError(error, 'Không thể đổi mật khẩu. Vui lòng thử lại.');
      setFieldErrors(mapped.fieldErrors as PasswordFieldErrors);
      setSubmitError(mapped.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FlowScreen muted onBack={onBack} title="Đổi mật khẩu" titleAlign="left">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 bg-bg-muted"
          contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-4 rounded-2xl bg-bg-card p-4">
            <Text className="text-body-sm text-text-secondary">
              Sau khi đổi mật khẩu, tất cả thiết bị khác đang đăng nhập tài khoản này sẽ tự động
              được đăng xuất để bảo vệ tài khoản.
            </Text>

            <Input
              autoCapitalize="none"
              autoComplete="current-password"
              error={fieldErrors.currentPassword}
              label="Mật khẩu hiện tại"
              leftIcon="lock-outline"
              maxLength={72}
              onChangeText={(text) => setField('currentPassword', text)}
              passwordToggle
              placeholder="Nhập mật khẩu đang dùng"
              required
              value={values.currentPassword}
            />

            <Input
              autoCapitalize="none"
              autoComplete="new-password"
              error={fieldErrors.newPassword}
              label="Mật khẩu mới"
              leftIcon="vpn-key"
              maxLength={72}
              onChangeText={(text) => setField('newPassword', text)}
              passwordToggle
              placeholder="Từ 8 đến 72 ký tự"
              required
              value={values.newPassword}
            />

            <Input
              autoCapitalize="none"
              autoComplete="new-password"
              error={fieldErrors.confirmPassword}
              label="Xác nhận mật khẩu mới"
              leftIcon="vpn-key"
              maxLength={72}
              onChangeText={(text) => setField('confirmPassword', text)}
              onSubmitEditing={() => void submit()}
              passwordToggle
              placeholder="Nhập lại mật khẩu mới"
              required
              returnKeyType="go"
              value={values.confirmPassword}
            />
          </View>

          {submitError ? <InlineMessage message={submitError} type="error" /> : null}

          <Button
            disabled={isSubmitting}
            label={isSubmitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            loading={isSubmitting}
            onPress={() => void submit()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </FlowScreen>
  );
}
