import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from 'heroui-native';
import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

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
    <View className="gap-4">
      {permission?.granted ? (
        <CameraView
          style={{ height: 280, borderRadius: 16, overflow: 'hidden' }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={busy || paused ? undefined : ({ data }) => void submit(data)}
        />
      ) : (
        <View className="items-center gap-3 rounded-xl bg-surface-secondary p-5">
          <Text className="font-body text-body-sm text-foreground">
            Cần quyền camera để quét mã.
          </Text>
          <Button onPress={() => void requestPermission()}>
            <Button.Label>Cho phép camera</Button.Label>
          </Button>
        </View>
      )}
      <TextInput
        accessibilityLabel="Nhập mã QR thủ công"
        autoCapitalize="none"
        className="rounded-xl border border-border bg-surface px-3 py-3 font-body text-body-sm text-foreground"
        placeholder="Hoặc nhập mã QR thủ công"
        value={payload}
        onChangeText={setPayload}
      />
      <Button isDisabled={busy || !payload.trim()} onPress={() => void submit(payload)}>
        <Button.Label>{busy ? 'Đang kiểm tra…' : 'Xác thực mã'}</Button.Label>
      </Button>
      {error ? (
        <View className="gap-3">
          <Text className="rounded-xl bg-danger-bg p-3 font-body text-body-sm text-danger">
            {error}
          </Text>
          <Button variant="secondary" onPress={retry}>
            <Button.Label>Quét lại</Button.Label>
          </Button>
        </View>
      ) : null}
    </View>
  );
}
