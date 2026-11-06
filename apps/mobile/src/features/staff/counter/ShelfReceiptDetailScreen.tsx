import { useRouter } from 'expo-router';
import { Button } from 'heroui-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useSession } from '../../../../lib/session';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { ShelfReceiptView } from '../../../components/ShelfReceiptView';
import { shelfApiError } from '../staff-errors';
import { useFocusLoader } from './use-focus-loader';
import { VoidReceiptForm } from './VoidReceiptForm';

const VOID_ROLES = ['FACILITY_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN'];

/** A saved receipt; managers may void an active one (the API checks the facility scope). */
export function ShelfReceiptDetailScreen({ receiptId }: { receiptId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canVoid = user?.roles.some((role) => VOID_ROLES.includes(role)) ?? false;
  const fetcher = useCallback(() => ShelfStorageApi.getReceipt(receiptId), [receiptId]);
  const {
    data: receipt,
    setData,
    error,
    reload,
  } = useFocusLoader(fetcher, 'Không tải được phiếu.');
  const [voiding, setVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const voidReceipt = async (reason: string) => {
    setVoiding(true);
    setVoidError(null);
    try {
      setData(await ShelfStorageApi.voidReceipt(receiptId, { reason }));
    } catch (cause) {
      setVoidError(shelfApiError(cause, 'Không hủy được phiếu.'));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Chi tiết phiếu"
        backLabel="Quay lại Gửi / lấy đồ"
        onBack={() => router.navigate('/(staff)/scan')}
      />
      <ScrollView contentContainerClassName="gap-4 px-4 pb-10">
        {error ? (
          <View className="gap-2 rounded-xl bg-danger-bg p-3">
            <Text className="font-body text-body-sm text-danger">{error}</Text>
            <Button size="sm" variant="secondary" onPress={() => void reload()}>
              <Button.Label>Thử lại</Button.Label>
            </Button>
          </View>
        ) : !receipt ? (
          <ActivityIndicator />
        ) : (
          <>
            <ShelfReceiptView receipt={receipt} />
            {canVoid && receipt.status === 'ACTIVE' ? (
              <VoidReceiptForm
                busy={voiding}
                error={voidError}
                onVoid={(r) => void voidReceipt(r)}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
