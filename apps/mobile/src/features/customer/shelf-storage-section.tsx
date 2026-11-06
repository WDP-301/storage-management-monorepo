import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { pickupRequestBlockLabel } from '../../../lib/shelf-storage-format';
import type { ApiContract } from '../../types/contract-api';
import { SectionCard } from './contract-sections';
import { PickupRequestCard } from './PickupRequestCard';
import { PickupRequestSheet } from './PickupRequestSheet';
import { ShelfReceiptHistory } from './ShelfReceiptHistory';
import { ShelfStockList } from './ShelfStockList';
import { useShelfStorage } from './use-shelf-storage';

/** "Đồ đang gửi" on a shelf contract: stock, pick-up requests and receipt history. */
export function ShelfStorageSection({ contract }: { contract: ApiContract }) {
  if (
    contract.unit?.kind !== 'SHELF' ||
    (contract.status !== 'ACTIVE' && contract.status !== 'ENDED')
  ) {
    return null;
  }
  return <ShelfStorageBody contract={contract} />;
}

function ShelfStorageBody({ contract }: { contract: ApiContract }) {
  const { data, isLoading, isLoadingMore, error, loadMore, reload } = useShelfStorage(
    contract.id,
    contract,
  );
  const sheetRef = useRef<BottomSheetModal>(null);
  const [pastOpen, setPastOpen] = useState(false);

  const storage = data?.storage;
  const past = data?.requests.filter((request) => request.id !== storage?.openRequest?.id) ?? [];
  const block = storage?.pickupRequestBlock ?? null;
  const canRequest = contract.status === 'ACTIVE';

  return (
    <SectionCard
      title="Đồ đang gửi"
      badge={storage ? `Kệ ${storage.shelf.code}` : 'Kệ'}
      tone="accent"
    >
      {isLoading && !data ? <ActivityIndicator /> : null}
      {error ? (
        <View className="gap-2">
          <Text className="font-body text-body-sm text-danger">{error}</Text>
          <Button variant="secondary" onPress={reload}>
            <Button.Label>Thử lại</Button.Label>
          </Button>
        </View>
      ) : null}
      {data && storage ? (
        <>
          <ShelfStockList items={storage.items} />

          {storage.openRequest ? (
            <View className="gap-2">
              <Text className="font-strong text-body-sm text-foreground">Yêu cầu lấy đồ</Text>
              <PickupRequestCard request={storage.openRequest} onCancelled={reload} />
            </View>
          ) : null}

          {canRequest ? (
            <View className="gap-1.5">
              <Button
                isDisabled={block !== null}
                variant="secondary"
                onPress={() => sheetRef.current?.present()}
              >
                <Button.Label>Yêu cầu lấy đồ</Button.Label>
              </Button>
              {block ? (
                <Text className="font-body text-caption text-muted">
                  {pickupRequestBlockLabel(block)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {past.length > 0 ? (
            <View className="gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: pastOpen }}
                onPress={() => setPastOpen((open) => !open)}
              >
                <Text className="font-strong text-body-sm text-accent">
                  Yêu cầu trước đây ({past.length}) {pastOpen ? '▴' : '▾'}
                </Text>
              </Pressable>
              {pastOpen ? past.map((r) => <PickupRequestCard key={r.id} request={r} />) : null}
            </View>
          ) : null}

          <ShelfReceiptHistory
            receipts={data.receipts}
            hasMore={data.hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
          <PickupRequestSheet
            sheetRef={sheetRef}
            contractId={contract.id}
            items={storage.items}
            onSubmitted={reload}
          />
        </>
      ) : null}
    </SectionCard>
  );
}
