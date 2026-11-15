import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { AlertSheet, Button, InlineMessage, Input, Text } from '../../../components/ui';

/** Manager-only: a saved receipt is never edited, only voided with a reason the customer will read. */
export function VoidReceiptForm({
  busy,
  error,
  onVoid,
}: {
  busy: boolean;
  error: string | null;
  onVoid: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const confirmRef = useRef<BottomSheetModal>(null);
  const trimmed = reason.trim();
  const valid = trimmed.length >= 3 && trimmed.length <= 500;

  if (!open) {
    return (
      <Button fullWidth label="Hủy phiếu" onPress={() => setOpen(true)} variant="destructive" />
    );
  }
  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-body-lg font-semibold text-text-primary">Hủy phiếu</Text>
      <Text className="text-body text-text-secondary">
        Số đồ trên kệ sẽ được cập nhật lại và khách sẽ thấy lý do hủy.
      </Text>
      <Input
        accessibilityLabel="Lý do hủy phiếu"
        maxLength={500}
        multiline
        onChangeText={setReason}
        placeholder="Lý do hủy (từ 3 ký tự)"
        value={reason}
      />
      {error ? <InlineMessage message={error} type="error" /> : null}
      <View className="flex-row gap-2.5">
        <Button
          className="flex-1"
          disabled={busy}
          label="Đóng"
          onPress={() => setOpen(false)}
          variant="secondary"
        />
        <Button
          className="flex-1"
          disabled={busy || !valid}
          label={busy ? 'Đang hủy…' : 'Xác nhận hủy'}
          loading={busy}
          onPress={() => confirmRef.current?.present()}
          variant="destructive"
        />
      </View>

      <AlertSheet
        actionsLayout="row"
        destructive
        message="Số đồ trên kệ sẽ được hoàn tác và không thể khôi phục."
        onPrimary={() => onVoid(trimmed)}
        primaryLabel="Hủy phiếu"
        ref={confirmRef}
        secondaryLabel="Không"
        title="Hủy phiếu này?"
      />
    </View>
  );
}
