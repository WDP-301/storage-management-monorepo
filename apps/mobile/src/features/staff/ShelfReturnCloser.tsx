import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { InspectionsApi } from '../../../lib/inspections-api';
import { AlertSheet, Button, InlineMessage, Text } from '../../components/ui';
import { vietnamDayIso } from './return-dates';
import { staffErrorMessage } from './staff-errors';

/**
 * A shelf return has nothing to inspect: once the customer has taken every item (pick-up
 * receipts), whoever works at the branch closes it and the deposit settlement starts. The server
 * refuses while goods remain on the shelf.
 */
export function ShelfReturnCloser({
  returnId,
  onFinalized,
}: {
  returnId: string;
  onFinalized: () => void;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = formatIsoDate(vietnamDayIso(new Date()));

  const close = async () => {
    setBusy(true);
    setError(null);
    try {
      await InspectionsApi.finalize(returnId);
      onFinalized();
    } catch (err) {
      setError(staffErrorMessage(err, 'Không chốt được trả kệ.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-2.5">
      <Text className="text-body-sm text-text-secondary">
        Ghi phiếu lấy hết đồ trên kệ trước, rồi chốt trả kệ.
      </Text>
      {error ? <InlineMessage message={error} type="error" /> : null}
      <Button
        disabled={busy}
        fullWidth
        label={busy ? 'Đang chốt…' : 'Chốt trả kệ'}
        loading={busy}
        onPress={() => sheetRef.current?.present()}
      />
      <AlertSheet
        actionsLayout="row"
        destructive
        message={`Ngày trả ghi nhận là hôm nay (${today}) — tiền thuê, trả trước hạn (mất cọc) và phí tính theo ngày này, rồi chuyển sang quyết toán.`}
        onPrimary={() => void close()}
        primaryLabel="Chốt"
        ref={sheetRef}
        secondaryLabel="Huỷ"
        title="Chốt trả kệ?"
      />
    </View>
  );
}
