import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, colors, Icon, InlineMessage, Input, Text } from '../../../components/ui';

type Props = {
  busy: boolean;
  error: string | null;
  /** Resolves true once the code opened a session; the scanner then goes away with the screen state. */
  onSubmit: (payload: string) => Promise<boolean>;
  onDismissError: () => void;
};

/** Camera + manual entry for the customer's rotating code. A code is single use, so scans lock while busy. */
export function CounterScanner({ busy, error, onSubmit, onDismissError }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [payload, setPayload] = useState('');
  const [paused, setPaused] = useState(false);
  const lock = useRef(false);

  const submit = async (value: string) => {
    if (lock.current || !value.trim()) return;
    lock.current = true;
    setPaused(true);
    try {
      if (await onSubmit(value.trim())) setPayload('');
    } finally {
      lock.current = false;
    }
  };

  const retry = () => {
    onDismissError();
    setPaused(false);
  };

  return (
    <View className="gap-3">
      {permission?.granted ? (
        <View className="overflow-hidden rounded-[20px] border border-border-default bg-bg-card">
          <CameraView
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            facing="back"
            onBarcodeScanned={busy || paused ? undefined : ({ data }) => void submit(data)}
            style={{ height: 280 }}
          />
        </View>
      ) : (
        <View className="items-center gap-3 rounded-[20px] border border-border-default bg-bg-card p-6">
          <View className="size-12 items-center justify-center rounded-full bg-secondary-0">
            <Icon color={colors.semantic.actionPrimary} name="qr-code-scanner" size={24} />
          </View>
          <Text className="text-center text-body text-text-secondary">
            Cần quyền camera để quét mã.
          </Text>
          <Button label="Cho phép camera" onPress={() => void requestPermission()} />
        </View>
      )}

      <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
        <Input
          accessibilityLabel="Nhập mã QR thủ công"
          autoCapitalize="none"
          clearable
          leftIcon="qr-code-2"
          onChangeText={setPayload}
          placeholder="Hoặc nhập mã QR thủ công"
          value={payload}
        />
        <Button
          disabled={busy || !payload.trim()}
          fullWidth
          label={busy ? 'Đang kiểm tra…' : 'Xác thực mã'}
          loading={busy}
          onPress={() => void submit(payload)}
        />
      </View>

      {error ? (
        <View className="gap-3 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
          <InlineMessage message={error} type="error" />
          <Button fullWidth label="Quét lại" onPress={retry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
