import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSession } from '../../../../lib/session';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import { ShelfReceiptView } from '../../../components/ShelfReceiptView';
import { Button, colors, FlowScreen, InlineMessage } from '../../../components/ui';
import { shelfApiError } from '../staff-errors';
import { useFocusLoader } from './use-focus-loader';
import { VoidReceiptForm } from './VoidReceiptForm';

const VOID_ROLES = ['FACILITY_MANAGER', 'OPERATIONS_MANAGER', 'ADMIN'];

/** A saved receipt; managers may void an active one (the API checks the facility scope). */
export function ShelfReceiptDetailScreen({
  receiptId,
  backToTicketId,
}: {
  receiptId: string;
  /** Set when opened from a ticket: back returns there instead of the counter. */
  backToTicketId?: string;
}) {
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
    <FlowScreen
      backLabel={backToTicketId ? 'Quay lại yêu cầu' : 'Quay lại Gửi / lấy đồ'}
      muted
      onBack={() =>
        backToTicketId
          ? router.navigate(`/(staff)/staff-ticket?id=${encodeURIComponent(backToTicketId)}`)
          : router.navigate('/(staff)/scan')
      }
      title="Chi tiết phiếu"
    >
      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 py-4 pb-10">
        {error ? (
          <View className="gap-3 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
            <InlineMessage message={error} type="error" />
            <Button label="Thử lại" onPress={() => void reload()} size="sm" variant="secondary" />
          </View>
        ) : !receipt ? (
          <ActivityIndicator className="py-6" color={colors.semantic.actionPrimary} />
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
    </FlowScreen>
  );
}
