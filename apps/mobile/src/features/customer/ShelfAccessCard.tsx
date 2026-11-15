import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { Copy } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AccessApi, type AccessPass } from '../../../lib/access-api';
import { ApiError } from '../../../lib/api';
import { Button, colors, InlineMessage, Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';

function vietnamDayIso(time: number): string {
  return new Date(time + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The customer's single code for every shelf warehouse they rent in, shown to counter staff when
 * dropping off or picking up goods; staff pick the warehouse when scanning.
 */
export function ShelfAccessCard({ contracts }: { contracts: ApiContract[] }) {
  const shelves = contracts.filter(
    (contract) => contract.status === 'ACTIVE' && contract.unit?.kind === 'SHELF',
  );
  // The API stores the chosen rental day at noon UTC (19:00 in Vietnam).
  // Compare calendar days so the code opens at midnight on the displayed start date.
  const eligible = shelves.some(
    (contract) =>
      vietnamDayIso(new Date(contract.effectiveAt).getTime()) <= vietnamDayIso(Date.now()),
  );

  // The deadline is taken from ttlSeconds on the device clock, so a phone whose clock is off
  // neither shows a dead code nor rotates in a loop.
  const [pass, setPass] = useState<(AccessPass & { deadline: number }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);
  // A code that arrives after the screen lost focus is dropped rather than kept off screen.
  const focusedRef = useRef(false);
  const showing = pass !== null;
  useEffect(() => {
    if (!showing) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [showing]);
  const create = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const issued = await AccessApi.createPass();
      if (!focusedRef.current) return;
      setPass({ ...issued, deadline: Date.now() + issued.ttlSeconds * 1000 });
    } catch (cause) {
      if (!focusedRef.current) return;
      setPass(null);
      setError(passError(cause));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  // Contracts load after focus, so this also runs once they arrive and make the customer eligible.
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (eligible) void create();
      return () => {
        focusedRef.current = false;
        setPass(null);
        setError(null);
      };
    }, [eligible, create]),
  );

  const seconds = pass ? Math.max(0, Math.ceil((pass.deadline - now) / 1000)) : 0;
  const expired = pass !== null && seconds === 0;
  useEffect(() => {
    if (expired) void create();
  }, [expired, create]);

  if (shelves.length === 0) return null;

  return (
    <View className="items-center gap-3.5 rounded-[20px] border border-border-default bg-bg-card p-4">
      <View className="w-full gap-1">
        <Text className="text-body-lg font-bold text-text-primary">Mã gửi / lấy đồ tại quầy</Text>
        <Text className="text-body-sm text-text-secondary">
          {eligible
            ? 'Đưa mã cho nhân viên quầy khi gửi hoặc lấy đồ. Một mã dùng cho mọi kho bạn đang thuê kệ.'
            : 'Có thể dùng mã từ ngày bắt đầu thuê kệ.'}
        </Text>
      </View>

      {eligible && pass && seconds > 0 ? (
        <>
          <View className="rounded-2xl bg-secondary-0 p-4">
            <View className="rounded-xl bg-white p-3">
              <QRCode value={pass.qrPayload} size={196} />
            </View>
          </View>
          <PassCode value={pass.qrPayload} />
          <View className="items-center gap-0.5">
            <Text className="text-body-sm font-semibold text-text-brand tabular-nums">
              Mã tự đổi sau {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
            </Text>
            <Text className="text-center text-caption text-text-secondary">
              Mỗi mã chỉ dùng một lần và tự hết hạn, không chia sẻ ảnh chụp mã.
            </Text>
          </View>
        </>
      ) : null}

      {eligible && busy && !pass ? (
        <ActivityIndicator className="my-4" color={colors.semantic.actionPrimary} />
      ) : null}

      {error ? <InlineMessage message={error} type="error" /> : null}

      {eligible ? (
        <Button
          disabled={busy}
          label={busy ? 'Đang tạo mã…' : error ? 'Thử lại' : 'Đổi mã'}
          leftIcon="refresh"
          loading={busy}
          size="sm"
          variant="secondary"
          onPress={() => void create()}
        />
      ) : null}
    </View>
  );
}

/** The code as text, for counters that type it into the manual field instead of scanning. */
function PassCode({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <View className="w-full flex-row items-center gap-2 rounded-xl border border-border-default bg-bg-subtle px-3 py-2">
      <Text selectable className="flex-1 text-caption font-medium text-text-primary tabular-nums">
        {value}
      </Text>
      <Pressable
        accessibilityLabel="Sao chép mã gửi / lấy đồ"
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        onPress={() => {
          void Clipboard.setStringAsync(value);
          setCopied(true);
        }}
      >
        <View className="flex-row items-center gap-1 rounded-full border border-border-default bg-bg-card px-2.5 py-1.5">
          <Copy color={colors.semantic.textSecondary} size={13} weight="bold" />
          <Text className="text-caption font-medium text-text-primary">
            {copied ? 'Đã chép' : 'Chép'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function passError(cause: unknown): string {
  if (cause instanceof ApiError && cause.code === 'CHECK_IN_NOT_ALLOWED') {
    return 'Hiện chưa thể tạo mã. Nếu đã đến ngày bắt đầu thuê, vui lòng liên hệ nhân viên.';
  }
  if (cause instanceof ApiError && cause.code === 'INVOICE_OVERDUE') {
    return 'Vui lòng thanh toán hóa đơn quá hạn trước khi gửi / lấy đồ.';
  }
  return cause instanceof ApiError ? cause.message : 'Không tạo được mã.';
}
