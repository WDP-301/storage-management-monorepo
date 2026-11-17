import { useFocusEffect } from 'expo-router';
import { Check } from 'phosphor-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal as RNModal,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountApi } from '../../../lib/account-api';
import {
  buildUpdateProfilePayload,
  initialProfileValues,
  mapAccountError,
  type ProfileFieldErrors,
  type ProfileFormValues,
  validateProfileForm,
} from '../../../lib/account-form';
import { AuthApi } from '../../../lib/api';
import { WarehousesApi } from '../../../lib/warehouses-api';
import { Button, colors, FlowScreen, InlineMessage, Input, Text } from '../../components/ui';
import type { AuthUser, CustomerProfile } from '../../types/auth';
import type { ApiProvince, ApiWard } from '../../types/storage-api';

type Props = {
  user: AuthUser;
  includeCustomerFields: boolean;
  onUserUpdated: (user: AuthUser) => void;
  onBack: () => void;
};

type PickerMode = 'province' | 'ward' | null;

export function EditProfileScreen({ user, includeCustomerFields, onUserUpdated, onBack }: Props) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [values, setValues] = useState<ProfileFormValues>(() => initialProfileValues(user, null));
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(includeCustomerFields);
  const [isSaving, setIsSaving] = useState(false);

  const [provinces, setProvinces] = useState<ApiProvince[]>([]);
  const [wards, setWards] = useState<ApiWard[]>([]);
  const [isLoadingWards, setIsLoadingWards] = useState(false);
  const [picker, setPicker] = useState<PickerMode>(null);
  const [search, setSearch] = useState('');

  const userRef = useRef(user);
  userRef.current = user;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const loadProfile = useCallback(
    async (signal?: AbortSignal) => {
      setFieldErrors({});
      setSubmitError(null);
      if (!includeCustomerFields) {
        setValues(initialProfileValues(userRef.current, null));
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const detail = await AuthApi.meDetail(signal);
        if (signal?.aborted) return;
        setProfile(detail.profile);
        setValues(initialProfileValues(detail.user, detail.profile));
      } catch {
        if (!signal?.aborted) setValues(initialProfileValues(userRef.current, profileRef.current));
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [includeCustomerFields],
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void loadProfile(controller.signal);
      if (includeCustomerFields) {
        WarehousesApi.listProvinces(controller.signal)
          .then((rows) => {
            if (!controller.signal.aborted) setProvinces(rows);
          })
          .catch(() => undefined);
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBackRef.current();
        return true;
      });
      return () => {
        sub.remove();
        controller.abort();
      };
    }, [includeCustomerFields, loadProfile]),
  );

  useEffect(() => {
    if (!includeCustomerFields || !values.province) {
      setWards([]);
      return;
    }
    const controller = new AbortController();
    setIsLoadingWards(true);
    WarehousesApi.listWards(values.province, controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setWards(rows);
      })
      .catch(() => {
        if (!controller.signal.aborted) setWards([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingWards(false);
      });
    return () => controller.abort();
  }, [includeCustomerFields, values.province]);

  const setField = <K extends keyof ProfileFormValues>(field: K, value: ProfileFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
  };

  const selectedProvinceName = useMemo(
    () => provinces.find((p) => p.code === values.province)?.name ?? values.province,
    [provinces, values.province],
  );
  const selectedWardName = useMemo(
    () => wards.find((w) => w.code === values.ward)?.name ?? values.ward,
    [wards, values.ward],
  );

  const pickerItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = picker === 'province' ? provinces : wards;
    return q ? list.filter((item) => item.name.toLowerCase().includes(q)) : list;
  }, [picker, provinces, wards, search]);

  const submit = async () => {
    if (isSaving) return;
    const errors = validateProfileForm(values, { includeCustomerFields });
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = buildUpdateProfilePayload(values, { includeCustomerFields });
      const res = await AccountApi.updateProfile(user.id, payload);
      onUserUpdated({
        ...user,
        fullName: res.user.fullName,
        phone: res.user.phone,
      });
      Alert.alert('Đã lưu hồ sơ', 'Thông tin tài khoản của bạn đã được cập nhật.', [
        { text: 'Đóng', onPress: onBack },
      ]);
    } catch (error) {
      const mapped = mapAccountError(error, 'Không thể cập nhật thông tin tài khoản.');
      setFieldErrors(mapped.fieldErrors as ProfileFieldErrors);
      setSubmitError(mapped.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FlowScreen muted onBack={onBack} title="Chỉnh sửa hồ sơ" titleAlign="left">
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
          {isLoading ? (
            <ActivityIndicator className="my-4" color={colors.semantic.actionPrimary} />
          ) : (
            <>
              <View className="gap-4 rounded-2xl bg-bg-card p-4">
                <Text className="text-caption font-semibold text-text-secondary uppercase">
                  Thông tin cơ bản
                </Text>

                <Input disabled label="Email" leftIcon="mail-outline" value={user.email} />

                <Input
                  autoCapitalize="words"
                  error={fieldErrors.fullName}
                  label="Họ và tên"
                  leftIcon="person-outline"
                  maxLength={150}
                  onChangeText={(text) => setField('fullName', text)}
                  placeholder="Nguyễn Văn An"
                  required
                  value={values.fullName}
                />

                <Input
                  error={fieldErrors.phone}
                  keyboardType="phone-pad"
                  label="Số điện thoại"
                  leftIcon="phone"
                  maxLength={16}
                  onChangeText={(text) => setField('phone', text)}
                  placeholder="0912345678"
                  value={values.phone}
                />
              </View>

              {includeCustomerFields ? (
                <View className="gap-4 rounded-2xl bg-bg-card p-4">
                  <Text className="text-caption font-semibold text-text-secondary uppercase">
                    Địa chỉ & Xuất hóa đơn (tùy chọn)
                  </Text>

                  <Input
                    error={fieldErrors.addressLine}
                    label="Số nhà, tên đường"
                    leftIcon="place"
                    maxLength={255}
                    onChangeText={(text) => setField('addressLine', text)}
                    placeholder="VD: 123 Lê Lợi"
                    value={values.addressLine}
                  />

                  <PickerField
                    error={fieldErrors.province}
                    label="Tỉnh / Thành phố"
                    onPress={() => {
                      setSearch('');
                      setPicker('province');
                    }}
                    placeholder="Chọn Tỉnh/Thành phố"
                    value={selectedProvinceName}
                  />

                  <PickerField
                    disabled={!values.province || isLoadingWards}
                    error={fieldErrors.ward}
                    label="Phường / Xã"
                    onPress={() => {
                      if (!values.province) return;
                      setSearch('');
                      setPicker('ward');
                    }}
                    placeholder={
                      !values.province
                        ? 'Chọn Tỉnh/Thành phố trước'
                        : isLoadingWards
                          ? 'Đang tải danh sách...'
                          : 'Chọn Phường/Xã'
                    }
                    value={selectedWardName}
                  />

                  <Input
                    error={fieldErrors.companyName}
                    label="Tên công ty"
                    leftIcon="business"
                    maxLength={255}
                    onChangeText={(text) => setField('companyName', text)}
                    placeholder="Nếu thuê cho doanh nghiệp"
                    value={values.companyName}
                  />

                  <Input
                    error={fieldErrors.taxCode}
                    keyboardType="number-pad"
                    label="Mã số thuế"
                    leftIcon="receipt-long"
                    maxLength={20}
                    onChangeText={(text) => setField('taxCode', text)}
                    placeholder="VD: 0312345678"
                    value={values.taxCode}
                  />
                </View>
              ) : null}

              {submitError ? <InlineMessage message={submitError} type="error" /> : null}

              <Button
                disabled={isSaving}
                label={isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                loading={isSaving}
                onPress={() => void submit()}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <RNModal
        animationType="slide"
        onRequestClose={() => setPicker(null)}
        transparent={false}
        visible={picker !== null}
      >
        <SafeAreaView className="flex-1 bg-bg-page" edges={['top', 'bottom']}>
          <View className="flex-row items-center justify-between border-b border-border-default px-4 py-3">
            <Text className="text-title-sm font-bold text-text-primary">
              {picker === 'province' ? 'Chọn Tỉnh / Thành phố' : 'Chọn Phường / Xã'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setPicker(null)}>
              <Text className="text-body font-semibold text-text-link">Đóng</Text>
            </Pressable>
          </View>

          <View className="border-b border-border-divider px-4 py-3">
            <Input
              clearable
              leftIcon="search"
              onChangeText={setSearch}
              placeholder="Tìm nhanh theo tên..."
              value={search}
            />
          </View>

          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
            {(picker === 'province' && values.province) || (picker === 'ward' && values.ward) ? (
              <Pressable
                accessibilityRole="button"
                className="border-b border-border-divider px-4 py-3.5"
                onPress={() => {
                  if (picker === 'province') {
                    setValues((prev) => ({ ...prev, province: '', ward: '' }));
                    setFieldErrors((prev) => ({ ...prev, province: undefined, ward: undefined }));
                  } else {
                    setField('ward', '');
                  }
                  setPicker(null);
                }}
              >
                <Text className="text-body font-medium text-status-danger">
                  Xóa lựa chọn hiện tại
                </Text>
              </Pressable>
            ) : null}

            {pickerItems.map((item) => {
              const currentCode = picker === 'province' ? values.province : values.ward;
              const isSelected = item.code === currentCode;
              return (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  className="flex-row items-center justify-between border-b border-border-divider px-4 py-3.5"
                  onPress={() => {
                    if (picker === 'province') {
                      setValues((prev) => ({
                        ...prev,
                        province: item.code,
                        ward: prev.province === item.code ? prev.ward : '',
                      }));
                      setFieldErrors((prev) => ({
                        ...prev,
                        province: undefined,
                        ward: undefined,
                      }));
                    } else {
                      setField('ward', item.code);
                    }
                    setPicker(null);
                  }}
                >
                  <Text
                    className={`flex-1 text-body ${
                      isSelected ? 'font-semibold text-text-link' : 'text-text-primary'
                    }`}
                  >
                    {item.name}
                  </Text>
                  {isSelected ? <Check color={colors.semantic.actionPrimary} size={18} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </RNModal>
    </FlowScreen>
  );
}

function PickerField({
  label,
  value,
  placeholder,
  error,
  disabled = false,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-caption font-medium text-text-secondary">{label}</Text>
      <Pressable
        accessibilityRole="button"
        className={`min-h-[46px] flex-row items-center justify-between rounded-xl border px-4 ${
          error ? 'border-border-error' : 'border-transparent'
        } ${disabled ? 'bg-action-disabled' : 'bg-bg-subtle'}`}
        disabled={disabled}
        onPress={onPress}
      >
        <Text
          className={`flex-1 text-body ${
            value && !disabled ? 'text-text-primary' : 'text-text-placeholder'
          }`}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Text className="text-caption font-semibold text-text-link">Chọn</Text>
      </Pressable>
      {error ? <Text className="text-caption text-status-danger">{error}</Text> : null}
    </View>
  );
}
