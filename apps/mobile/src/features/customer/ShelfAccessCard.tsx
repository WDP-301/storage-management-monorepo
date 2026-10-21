import { useFocusEffect } from 'expo-router';
import { Button } from 'heroui-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AccessApi, type AccessPass } from '../../../lib/access-api';
import { ApiError } from '../../../lib/api';
import type { ApiContract } from '../../types/contract-api';

function vietnamDayIso(time: number): string {
  return new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The customer's single check-in code for every shelf warehouse they rent in; staff pick the
 * warehouse when scanning. While shown, the code is replaced as soon as it expires.
 */
export function ShelfAccessCard({ contracts }: { contracts: ApiContract[] }) {
  // The deadline is taken from ttlSeconds on the device clock, so a phone whose clock is off
  // neither shows a dead code nor rotates in a loop.
  const [pass, setPass] = useState<(AccessPass & { deadline: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);
  const showing = pass !== null;
  useEffect(() => {
    if (!showing) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showing]);
  useFocusEffect(useCallback(() => () => setPass(null), []));

  const create = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const issued = await AccessApi.createPass();
      setPass({ ...issued, deadline: Date.now() + issued.ttlSeconds * 1000 });
    } catch (cause) {
      setPass(null);
      setError(passError(cause));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const seconds = pass ? Math.max(0, Math.ceil((pass.deadline - now) / 1000)) : 0;
  const expired = pass !== null && seconds === 0;
  useEffect(() => {
    if (expired) void create();
  }, [expired, create]);

  const shelves = contracts.filter(
    (contract) => contract.status === 'ACTIVE' && contract.unit?.kind === 'SHELF',
  );
  if (shelves.length === 0) return null;
  // The API stores the chosen rental day at noon UTC (19:00 in Vietnam).
  // Compare calendar days so the code opens at midnight on the displayed start date.
  const eligible = shelves.some(
    (contract) =>
      vietnamDayIso(new Date(contract.effectiveAt).getTime()) <= vietnamDayIso(Date.now()),
  );

  return (
    <View className="mt-4 items-center gap-3 rounded-xl border border-border bg-surface p-4">
      <Text className="self-start font-strong text-body-md text-foreground">Mã vào kho</Text>
      <Text className="self-start font-body text-body-sm text-muted">
        {eligible
          ? 'Một mã dùng cho mọi kho bạn đang thuê kệ. Đưa mã cho nhân viên quét khi vào kho.'
          : 'Có thể dùng mã khi tới ngày bắt đầu thuê kệ.'}
      </Text>
      {eligible && pass && seconds > 0 ? (
        <>
          <View className="rounded-xl bg-white p-3">
            <QRCode value={pass.qrPayload} size={210} />
          </View>
          <Text className="font-ui text-body-sm text-foreground">
            Mã tự đổi sau {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </Text>
          <Text className="font-body text-caption text-muted">
            Mỗi mã chỉ dùng một lần và tự hết hạn, không nên chia sẻ ảnh chụp mã.
          </Text>
        </>
      ) : null}
      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      {eligible ? (
        <Button
          isDisabled={busy}
          variant={pass ? 'secondary' : 'primary'}
          onPress={() => void create()}
        >
          <Button.Label>
            {busy ? 'Đang tạo mã…' : pass ? 'Làm mới mã' : 'Hiện mã vào kho'}
          </Button.Label>
        </Button>
      ) : null}
    </View>
  );
}

function passError(cause: unknown): string {
  if (cause instanceof ApiError && cause.code === 'CHECK_IN_NOT_ALLOWED') {
    return 'Hiện chưa thể tạo mã vào kho. Nếu đã đến ngày bắt đầu thuê, vui lòng liên hệ nhân viên.';
  }
  if (cause instanceof ApiError && cause.code === 'INVOICE_OVERDUE') {
    return 'Vui lòng thanh toán hóa đơn quá hạn trước khi tạo mã vào kho.';
  }
  return cause instanceof ApiError ? cause.message : 'Không tạo được mã vào kho.';
}
