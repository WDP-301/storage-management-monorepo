import * as Clipboard from 'expo-clipboard';
import { Button, useThemeColor } from 'heroui-native';
import { Copy } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { formatIsoDateTime, formatMoney } from '../../../lib/format-vi';
import { type FirstRent, StaffContractsApi } from '../../../lib/staff-contracts-api';
import { SectionCard } from '../customer/contract-sections';

const POLL_INTERVAL_MS = 5000;

type Props = {
  contractId: string;
  monthlyPrice: number;
  firstRent: FirstRent | null;
  canCollect: boolean;
  onChanged: () => void;
};

export function FirstRentSection({
  contractId,
  monthlyPrice,
  firstRent,
  canCollect,
  onChanged,
}: Props) {
  const [current, setCurrent] = useState(firstRent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setCurrent(firstRent), [firstRent]);
  useEffect(() => {
    setError(null);
    setBusy(false);
  }, [contractId]);

  const paid = current?.status === 'PAID';
  const awaitingTransfer = Boolean(current && !paid && current.amountDue > 0);

  // SePay confirms bank transfers through the API's webhook, so the card polls the staff view
  // until the invoice flips to PAID — no manual refresh like the customer side used to need.
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  useEffect(() => {
    if (!awaitingTransfer) return;
    let stopped = false;
    let inFlight = false;
    const check = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const fresh = await StaffContractsApi.get(contractId);
        if (stopped || !fresh.firstRent) return;
        setCurrent(fresh.firstRent);
        // Let the parent reload too: payment unlocks the handover next door.
        if (fresh.firstRent.status === 'PAID') onChangedRef.current();
      } catch {
        // A failed poll only delays the badge; pull-to-refresh still works.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(() => void check(), POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [awaitingTransfer, contractId]);

  const run = async (action: 'issue' | 'cash') => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated =
        action === 'issue'
          ? await StaffContractsApi.issueFirstRent(contractId)
          : await StaffContractsApi.confirmFirstRentCash(contractId);
      setCurrent(updated);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Không cập nhật được tiền thuê tháng đầu. Vui lòng thử lại.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmCash = () => {
    if (!current || current.amountDue <= 0) return;
    Alert.alert(
      'Xác nhận đã nhận tiền mặt?',
      `Chỉ xác nhận sau khi đã nhận ${formatMoney(current.amountDue)} từ khách. Giao dịch sẽ được ghi nhận là đã thanh toán.`,
      [
        { text: 'Huỷ', style: 'cancel' },
        { text: 'Đã nhận tiền', onPress: () => void run('cash') },
      ],
    );
  };

  return (
    <SectionCard
      title="Tiền thuê tháng đầu"
      badge={paid ? 'Đã thanh toán' : current ? 'Chờ thanh toán' : 'Chưa tạo hóa đơn'}
      tone={paid ? 'success' : 'neutral'}
    >
      <View className="gap-3">
        <Text className="font-numeric-strong text-num-lg text-foreground">
          {formatMoney(current?.total ?? monthlyPrice)}
        </Text>
        {paid ? (
          <Text className="font-body text-body-sm text-muted">
            Đã thu{current?.paidAt ? ` lúc ${formatIsoDateTime(current.paidAt)}` : ''}
            {current?.method === 'CASH' ? ' bằng tiền mặt' : ''}.
          </Text>
        ) : current ? (
          <>
            <Text className="font-body text-body-sm text-foreground">
              Còn phải thu: {formatMoney(current.amountDue)}
            </Text>
            {current.paymentQrUrl ? (
              <Image
                accessibilityLabel="VietQR thanh toán tiền thuê tháng đầu"
                source={{ uri: current.paymentQrUrl }}
                style={{ width: 240, height: 300, alignSelf: 'center' }}
                resizeMode="contain"
              />
            ) : (
              <Text className="font-body text-body-sm text-muted">
                Chưa có mã VietQR. Có thể thu tiền mặt và xác nhận bên dưới.
              </Text>
            )}
            <View className="gap-1.5">
              <Text className="font-body text-body-sm text-muted">
                Nội dung chuyển khoản — khách cần ghi đúng để hệ thống tự đối soát:
              </Text>
              <CopyableText value={current.invoiceNo} />
            </View>
            <Text className="font-body text-body-sm text-muted">
              Trạng thái tự cập nhật khi hệ thống ghi nhận chuyển khoản.
            </Text>
            {canCollect ? (
              <Button variant="secondary" isDisabled={busy} onPress={confirmCash}>
                <Button.Label>{busy ? 'Đang xử lý…' : 'Xác nhận đã nhận tiền mặt'}</Button.Label>
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <Text className="font-body text-body-sm text-muted">
              Cần thu tiền thuê tháng đầu trước khi chốt biên nhận.
            </Text>
            {canCollect ? (
              <Button variant="secondary" isDisabled={busy} onPress={() => void run('issue')}>
                <Button.Label>{busy ? 'Đang tạo…' : 'Tạo hóa đơn và VietQR'}</Button.Label>
              </Button>
            ) : null}
          </>
        )}
        {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      </View>
    </SectionCard>
  );
}

/** The transfer reference staff reads out or sends to the customer, one tap to copy. */
function CopyableText({ value }: { value: string }) {
  const [mutedColor] = useThemeColor(['muted']);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <View className="w-full flex-row items-center gap-2 rounded-xl bg-surface-secondary px-3 py-2">
      <Text selectable className="flex-1 font-numeric text-caption text-foreground">
        {value}
      </Text>
      <Pressable
        accessibilityLabel="Sao chép nội dung chuyển khoản"
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        onPress={() => {
          void Clipboard.setStringAsync(value);
          setCopied(true);
        }}
      >
        <View className="flex-row items-center gap-1 rounded-full bg-surface px-2.5 py-1.5">
          <Copy color={mutedColor} size={13} weight="bold" />
          <Text className="font-ui text-caption text-subtle">{copied ? 'Đã chép' : 'Chép'}</Text>
        </View>
      </Pressable>
    </View>
  );
}
