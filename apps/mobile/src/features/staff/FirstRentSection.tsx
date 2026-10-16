import { Button } from 'heroui-native';
import { useEffect, useState } from 'react';
import { Alert, Image, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { formatIsoDateTime, formatMoney } from '../../../lib/format-vi';
import { type FirstRent, StaffContractsApi } from '../../../lib/staff-contracts-api';
import { SectionCard } from '../customer/contract-sections';

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
            <Text className="font-body text-body-sm text-muted">
              Nội dung chuyển khoản: {current.invoiceNo}
            </Text>
            <Text className="font-body text-body-sm text-muted">
              Nếu khách đã chuyển khoản, làm mới màn hình để kiểm tra trạng thái trước khi chốt.
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
