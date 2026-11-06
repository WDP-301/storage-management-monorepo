import { Button } from 'heroui-native';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

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
  const trimmed = reason.trim();
  const valid = trimmed.length >= 3 && trimmed.length <= 500;

  if (!open) {
    return (
      <Button variant="danger-soft" onPress={() => setOpen(true)}>
        <Button.Label>Hủy phiếu</Button.Label>
      </Button>
    );
  }
  return (
    <View className="gap-3 rounded-xl border border-border bg-surface p-4">
      <Text className="font-strong text-body-md text-foreground">Hủy phiếu</Text>
      <Text className="font-body text-body-sm text-muted">
        Số đồ trên kệ sẽ được cập nhật lại và khách sẽ thấy lý do hủy.
      </Text>
      <TextInput
        accessibilityLabel="Lý do hủy phiếu"
        className="min-h-20 rounded-xl border border-border bg-background px-3 py-3 font-body text-body-sm text-foreground"
        maxLength={500}
        multiline
        placeholder="Lý do hủy (từ 3 ký tự)"
        textAlignVertical="top"
        value={reason}
        onChangeText={setReason}
      />
      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          variant="secondary"
          isDisabled={busy}
          onPress={() => setOpen(false)}
        >
          <Button.Label>Đóng</Button.Label>
        </Button>
        <Button
          className="flex-1"
          variant="danger"
          isDisabled={busy || !valid}
          onPress={() =>
            Alert.alert('Hủy phiếu này?', 'Không thể hoàn tác.', [
              { text: 'Không', style: 'cancel' },
              { text: 'Hủy phiếu', style: 'destructive', onPress: () => onVoid(trimmed) },
            ])
          }
        >
          <Button.Label>{busy ? 'Đang hủy…' : 'Xác nhận hủy'}</Button.Label>
        </Button>
      </View>
    </View>
  );
}
