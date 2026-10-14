import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from 'heroui-native';
import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AccessApi, type CheckInResult } from '../../../lib/access-api';
import { ApiError } from '../../../lib/api';

export function StaffScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [payload, setPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [paused, setPaused] = useState(false);
  const lock = useRef(false);
  const submit = async (value: string) => {
    if (lock.current || !value.trim()) return;
    lock.current = true;
    setPaused(true);
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const checkIn = await AccessApi.checkIn(value.trim());
      setResult(checkIn);
      setPayload('');
    } catch (cause) {
      setError(scanError(cause));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <View className="flex-1 gap-4 bg-background px-4 pt-6">
      <Text className="font-strong text-title-md text-foreground">Quét mã vào kho</Text>
      <Text className="font-body text-body-sm text-muted">
        Quét mã QR trên điện thoại khách thuê kệ. Mỗi mã chỉ dùng một lần.
      </Text>
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
        <Text className="rounded-xl bg-danger-bg p-3 font-body text-body-sm text-danger">
          {error}
        </Text>
      ) : null}
      {error ? (
        <Button
          variant="secondary"
          onPress={() => {
            setError(null);
            setPaused(false);
          }}
        >
          <Button.Label>Quét lại</Button.Label>
        </Button>
      ) : null}
      {result ? (
        <View className="gap-2 rounded-xl border border-success bg-success-bg p-4">
          <Text className="font-strong text-body-md text-success">Đã ghi nhận vào kho</Text>
          <Text className="font-body text-body-sm text-foreground">
            Khách: {result.customer.fullName ?? result.customer.phone ?? '—'}
          </Text>
          <Text className="font-body text-body-sm text-foreground">
            Hợp đồng: {result.contract.contractNo}
          </Text>
          <Text className="font-body text-body-sm text-foreground">
            Kệ: {result.unit.code} · {result.unit.name}
          </Text>
          <Text className="font-body text-body-sm text-foreground">
            Kho: {result.warehouse?.name ?? result.facility.name}
          </Text>
          <Text className="font-body text-caption text-muted">
            {new Date(result.usedAt).toLocaleString('vi-VN')}
          </Text>
          <Button
            variant="secondary"
            onPress={() => {
              setResult(null);
              setPaused(false);
            }}
          >
            <Button.Label>Quét mã tiếp theo</Button.Label>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function scanError(cause: unknown): string {
  if (!(cause instanceof ApiError)) return 'Không xác thực được mã vào kho.';
  if (cause.code === 'FORBIDDEN')
    return 'Mã này thuộc cơ sở khác hoặc bạn chưa được phân quyền tại cơ sở đó.';
  if (cause.code === 'INVOICE_OVERDUE') return 'Khách có hóa đơn quá hạn và chưa thể vào kho.';
  if (cause.code === 'ACCESS_PASS_INVALID') {
    const reason = cause.details?.reason;
    if (reason === 'USED') return 'Mã này đã được sử dụng.';
    if (reason === 'EXPIRED') return 'Mã đã hết hạn. Hãy yêu cầu khách tạo mã mới.';
    return 'Mã QR không hợp lệ hoặc đã bị thay thế.';
  }
  if (cause.code === 'CHECK_IN_NOT_ALLOWED') return 'Hợp đồng chưa đủ điều kiện để vào kho.';
  return cause.message;
}
