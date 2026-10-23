import { useFocusEffect } from 'expo-router';
import { Button } from 'heroui-native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { AccessApi, type Visit } from '../../../lib/access-api';
import { ApiError } from '../../../lib/api';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { formatStay } from '../../../lib/visit-format';

/**
 * Customers inside the chosen warehouse. Reloads on focus and whenever `refreshKey` changes (after
 * each scan). Staff can let a customer out without the exit scan, giving the reason.
 */
export function StaffInsideList({
  warehouseId,
  refreshKey,
}: {
  warehouseId: string;
  refreshKey: number;
}) {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const list = await AccessApi.inside(warehouseId);
      if (request === requestRef.current) setVisits(list);
    } catch (cause) {
      if (request === requestRef.current) {
        setError(cause instanceof ApiError ? cause.message : 'Không tải được danh sách.');
      }
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [warehouseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, refreshKey]),
  );

  return (
    <View className="gap-3 rounded-xl border border-border bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-strong text-body-md text-foreground">
          Đang trong kho{visits ? ` (${visits.length})` : ''}
        </Text>
        <Button size="sm" variant="secondary" isDisabled={loading} onPress={() => void load()}>
          <Button.Label>{loading ? 'Đang tải…' : 'Tải lại'}</Button.Label>
        </Button>
      </View>
      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}
      {!visits && loading ? <ActivityIndicator /> : null}
      {visits && visits.length === 0 ? (
        <Text className="font-body text-body-sm text-muted">Không có khách nào trong kho.</Text>
      ) : null}
      {visits?.map((visit) => (
        <InsideRow key={visit.id} visit={visit} onCheckedOut={() => void load()} />
      ))}
    </View>
  );
}

function InsideRow({ visit, onCheckedOut }: { visit: Visit; onCheckedOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || !note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await AccessApi.checkOutManually(visit.id, note.trim());
      onCheckedOut();
    } catch (cause) {
      if (cause instanceof ApiError && cause.details?.reason === 'ALREADY_CHECKED_OUT') {
        onCheckedOut();
        return;
      }
      setError(cause instanceof ApiError ? cause.message : 'Không cho ra được. Thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-2 rounded-lg bg-surface-secondary p-3">
      <Text className="font-strong text-body-sm text-foreground">
        {visit.customer.fullName ?? visit.customer.phone ?? 'Khách'}
      </Text>
      <Text className="font-body text-caption text-muted">
        Vào lúc {formatIsoDateTime(visit.checkedInAt)} · {formatStay(visit.checkedInAt, Date.now())}
      </Text>
      {open ? (
        <>
          <TextInput
            accessibilityLabel="Lý do cho ra không quét mã"
            className="rounded-lg border border-border bg-surface px-3 py-2 font-body text-body-sm text-foreground"
            placeholder="Lý do (VD: khách hết pin điện thoại)"
            maxLength={255}
            value={note}
            onChangeText={setNote}
          />
          {error ? <Text className="font-body text-caption text-danger">{error}</Text> : null}
          <View className="flex-row gap-2">
            <Button size="sm" isDisabled={busy || !note.trim()} onPress={() => void submit()}>
              <Button.Label>{busy ? 'Đang lưu…' : 'Xác nhận cho ra'}</Button.Label>
            </Button>
            <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => setOpen(false)}>
              <Button.Label>Hủy</Button.Label>
            </Button>
          </View>
        </>
      ) : (
        <Button size="sm" variant="secondary" onPress={() => setOpen(true)}>
          <Button.Label>Cho ra không quét mã</Button.Label>
        </Button>
      )}
    </View>
  );
}
