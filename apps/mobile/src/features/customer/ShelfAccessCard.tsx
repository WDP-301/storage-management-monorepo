import { useFocusEffect } from 'expo-router';
import { Button } from 'heroui-native';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AccessApi, type AccessPass } from '../../../lib/access-api';
import { ApiError } from '../../../lib/api';
import type { ApiContract } from '../../types/contract-api';

function vietnamDayIso(time: number): string {
  return new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function ShelfAccessCard({ contract }: { contract: ApiContract }) {
  const [pass, setPass] = useState<AccessPass | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setPass(null);
    setError(null);
  }, [contract.id]);
  useFocusEffect(useCallback(() => () => setPass(null), []));
  if (contract.unit?.kind !== 'SHELF') return null;
  // The API stores the chosen rental day at noon UTC (19:00 in Vietnam).
  // Compare calendar days so the button opens at midnight on the displayed start date.
  const eligible =
    contract.status === 'ACTIVE' &&
    vietnamDayIso(new Date(contract.effectiveAt).getTime()) <= vietnamDayIso(now);
  const seconds = pass
    ? Math.max(0, Math.ceil((new Date(pass.expiresAt).getTime() - now) / 1000))
    : 0;
  const create = async () => {
    setBusy(true);
    setError(null);
    setPass(null);
    try {
      setPass(await AccessApi.createPass(contract.id));
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'CHECK_IN_NOT_ALLOWED') {
        setError(
          'Hiện chưa thể tạo mã vào kho. Nếu đã đến ngày bắt đầu thuê, vui lòng liên hệ nhân viên.',
        );
      } else if (cause instanceof ApiError && cause.code === 'INVOICE_OVERDUE') {
        setError('Vui lòng thanh toán hóa đơn quá hạn trước khi tạo mã vào kho.');
      } else {
        setError(cause instanceof ApiError ? cause.message : 'Không tạo được mã vào kho.');
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <Text className="self-start font-strong text-body-md text-foreground">Mã vào kho kệ</Text>
      {!eligible ? (
        <Text className="self-start font-body text-body-sm text-muted">
          Có thể tạo mã khi hợp đồng đã có hiệu lực và tới ngày bắt đầu thuê.
        </Text>
      ) : null}
      {eligible && pass && seconds > 0 ? (
        <>
          <View className="rounded-xl bg-white p-3">
            <QRCode value={pass.qrPayload} size={210} />
          </View>
          <Text className="font-ui text-body-sm text-foreground">
            Hết hạn sau {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </Text>
          <Text className="font-body text-caption text-muted">
            Mỗi mã chỉ dùng một lần. Tạo mã mới sẽ hủy mã cũ.
          </Text>
        </>
      ) : null}
      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      {eligible ? (
        <Button isDisabled={busy} onPress={() => void create()}>
          <Button.Label>
            {busy ? 'Đang tạo mã…' : pass && seconds > 0 ? 'Tạo mã mới' : 'Tạo mã vào kho'}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}
