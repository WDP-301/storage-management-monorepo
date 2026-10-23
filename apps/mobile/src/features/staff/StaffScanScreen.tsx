import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from 'heroui-native';
import { useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { AccessApi, type CheckInResult, type ScanWarehouse } from '../../../lib/access-api';
import { ApiError } from '../../../lib/api';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { formatStay } from '../../../lib/visit-format';
import { ScanWarehousePicker } from './ScanWarehousePicker';
import { StaffInsideList } from './StaffInsideList';

export function StaffScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [payload, setPayload] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [warehouse, setWarehouse] = useState<ScanWarehouse | null>(null);
  const [insideRefresh, setInsideRefresh] = useState(0);
  const lock = useRef(false);
  const submit = async (value: string) => {
    if (lock.current || !value.trim() || !warehouse) return;
    lock.current = true;
    setPaused(true);
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const checkIn = await AccessApi.checkIn(value.trim(), warehouse.id);
      setResult(checkIn);
      setPayload('');
      setInsideRefresh((key) => key + 1);
    } catch (cause) {
      setError(scanError(cause));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  };
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 px-4 pt-6 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="font-strong text-title-md text-foreground">Quét mã vào / ra kho</Text>
      <Text className="font-body text-body-sm text-muted">
        Chọn kho rồi quét mã QR trên điện thoại khách thuê kệ, cả lúc vào và lúc ra. Hệ thống tự
        biết khách đang vào hay ra. Mỗi mã chỉ dùng một lần.
      </Text>
      <ScanWarehousePicker value={warehouse} onChange={setWarehouse} />
      {!warehouse ? null : permission?.granted ? (
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
      <Button
        isDisabled={busy || !payload.trim() || !warehouse}
        onPress={() => void submit(payload)}
      >
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
          <Text className="font-strong text-body-md text-success">
            {result.direction === 'OUT' ? 'Đã ghi nhận ra kho' : 'Đã ghi nhận vào kho'}
          </Text>
          <Text className="font-body text-body-sm text-foreground">
            Khách: {result.customer.fullName ?? result.customer.phone ?? '—'}
          </Text>
          <Text className="font-body text-body-sm text-foreground">
            Kho: {result.warehouse?.name ?? result.facility.name}
          </Text>
          <Text className="font-body text-caption text-muted">
            {result.direction === 'OUT' ? 'Ra lúc' : 'Vào lúc'} {formatIsoDateTime(result.usedAt)}
          </Text>
          {result.direction === 'OUT' && result.checkedInAt ? (
            <Text className="font-body text-caption text-muted">
              Vào lúc {formatIsoDateTime(result.checkedInAt)} · ở trong kho{' '}
              {formatStay(result.checkedInAt, Date.parse(result.usedAt))}
            </Text>
          ) : null}
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
      {warehouse ? <StaffInsideList warehouseId={warehouse.id} refreshKey={insideRefresh} /> : null}
    </ScrollView>
  );
}

function scanError(cause: unknown): string {
  if (!(cause instanceof ApiError)) return 'Không xác thực được mã vào kho.';
  if (cause.code === 'FORBIDDEN') return 'Bạn chưa được phân quyền tại cơ sở của kho này.';
  if (cause.code === 'RESOURCE_NOT_FOUND') return 'Không tìm thấy kho đã chọn.';
  if (cause.code === 'INVOICE_OVERDUE') return 'Khách có hóa đơn quá hạn và chưa thể vào kho.';
  if (cause.code === 'ACCESS_PASS_INVALID') {
    const reason = cause.details?.reason;
    if (reason === 'USED') return 'Mã này đã được sử dụng.';
    if (reason === 'EXPIRED') return 'Mã đã hết hạn. Hãy nhờ khách mở lại mã mới trên ứng dụng.';
    return 'Mã QR không hợp lệ hoặc đã bị thay thế.';
  }
  if (cause.code === 'CHECK_IN_NOT_ALLOWED') {
    const reason = cause.details?.reason;
    if (reason === 'NO_SHELF_CONTRACT') return 'Khách không thuê kệ nào đang hiệu lực tại kho này.';
    if (reason === 'CONTRACT_NOT_STARTED')
      return 'Hợp đồng thuê kệ tại kho này chưa tới ngày bắt đầu.';
    return 'Khách chưa đủ điều kiện để vào kho này.';
  }
  return cause.message;
}
