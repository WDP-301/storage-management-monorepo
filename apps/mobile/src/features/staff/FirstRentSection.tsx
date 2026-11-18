import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { formatIsoDateTime, formatMoney } from '../../../lib/format-vi';
import { type FirstRent, StaffContractsApi } from '../../../lib/staff-contracts-api';
import { AlertSheet, Button, InlineMessage, Text } from '../../components/ui';
import { SectionCard } from '../customer/contract-sections';
import { PaymentQr, TransferContent } from '../customer/payment-qr';

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
  const cashSheetRef = useRef<BottomSheetModal>(null);
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
    cashSheetRef.current?.present();
  };

  return (
    <SectionCard
      badge={paid ? 'Đã thanh toán' : current ? 'Chờ thanh toán' : 'Chưa tạo hóa đơn'}
      title="Tiền thuê tháng đầu"
      tone={paid ? 'success' : 'neutral'}
    >
      <View className="gap-3">
        <Text className="text-title font-bold text-text-primary tabular-nums">
          {formatMoney(current?.total ?? monthlyPrice)}
        </Text>
        {paid ? (
          <Text className="text-body text-text-secondary">
            Đã thu{current?.paidAt ? ` lúc ${formatIsoDateTime(current.paidAt)}` : ''}
            {current?.method === 'CASH' ? ' bằng tiền mặt' : ''}.
          </Text>
        ) : current ? (
          <>
            <Text className="text-body font-medium text-text-primary">
              Còn phải thu: {formatMoney(current.amountDue)}
            </Text>
            {current.paymentQrUrl ? (
              <PaymentQr
                label="Mã VietQR thanh toán tiền thuê tháng đầu"
                url={current.paymentQrUrl}
              />
            ) : (
              <Text className="text-body text-text-secondary">
                Chưa có mã VietQR. Có thể thu tiền mặt và xác nhận bên dưới.
              </Text>
            )}
            <TransferContent value={current.invoiceNo} />
            <InlineMessage
              message="Trạng thái tự cập nhật khi hệ thống ghi nhận chuyển khoản."
              type="info"
            />
            {canCollect ? (
              <Button
                disabled={busy}
                fullWidth
                label={busy ? 'Đang xử lý…' : 'Xác nhận đã nhận tiền mặt'}
                loading={busy}
                onPress={confirmCash}
                variant="secondary"
              />
            ) : null}
          </>
        ) : (
          <>
            <Text className="text-body text-text-secondary">
              Cần thu tiền thuê tháng đầu trước khi chốt biên nhận.
            </Text>
            {canCollect ? (
              <Button
                disabled={busy}
                fullWidth
                label={busy ? 'Đang tạo…' : 'Tạo hóa đơn và VietQR'}
                loading={busy}
                onPress={() => void run('issue')}
                variant="secondary"
              />
            ) : null}
          </>
        )}
        {error ? <InlineMessage message={error} type="error" /> : null}
      </View>

      <AlertSheet
        actionsLayout="row"
        message={
          current
            ? `Chỉ xác nhận sau khi đã nhận ${formatMoney(current.amountDue)} từ khách. Giao dịch sẽ được ghi nhận là đã thanh toán.`
            : ''
        }
        onPrimary={() => void run('cash')}
        primaryLabel="Đã nhận tiền"
        ref={cashSheetRef}
        secondaryLabel="Huỷ"
        title="Xác nhận đã nhận tiền mặt?"
      />
    </SectionCard>
  );
}
