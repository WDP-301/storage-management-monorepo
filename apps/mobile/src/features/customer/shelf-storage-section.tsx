import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  dropOffRequestBlockLabel,
  pickupRequestBlockLabel,
} from '../../../lib/shelf-storage-format';
import type { ApiContract } from '../../types/contract-api';
import { SectionCard } from './contract-sections';
import { DropOffRequestCard } from './DropOffRequestCard';
import { DropOffRequestForm } from './DropOffRequestForm';
import { PickupRequestCard } from './PickupRequestCard';
import { PickupRequestSheet } from './PickupRequestSheet';
import { RequestFormSheet } from './RequestFormSheet';
import { ShelfReceiptHistory } from './ShelfReceiptHistory';
import { ShelfStockList } from './ShelfStockList';
import { useShelfStorage } from './use-shelf-storage';

/** "Đồ đang gửi" on a shelf contract: stock, drop-off and pick-up requests, receipt history. */
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
  const dropOffSheetRef = useRef<BottomSheetModal>(null);
  const [pastOpen, setPastOpen] = useState(false);

  const storage = data?.storage;
  // Finished requests already show as receipts below, so only cancelled ones are listed.
  const past = data?.requests.filter((request) => request.status === 'CANCELLED') ?? [];
  const block = storage?.pickupRequestBlock ?? null;
  const openDropOff = storage?.openDropOffRequest ?? null;
  const pastDropOffs =
    data?.dropOffRequests.filter((request) => request.status === 'CANCELLED') ?? [];
  const dropOffBlock = storage?.dropOffRequestBlock ?? null;
  const canRequest = contract.status === 'ACTIVE';
  const pastCount = past.length + pastDropOffs.length;
  // An open request is already on screen and an empty shelf is obvious; only other reasons need words.
  const blockNote = [
    dropOffBlock && dropOffBlock !== 'OPEN_REQUEST_EXISTS'
      ? dropOffRequestBlockLabel(dropOffBlock)
      : null,
    block && block !== 'OPEN_REQUEST_EXISTS' && block !== 'NO_STOCK'
      ? pickupRequestBlockLabel(block)
      : null,
  ]
    .filter((note, i, all) => note && all.indexOf(note) === i)
    .join(' · ');

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

          {openDropOff ? <DropOffRequestCard request={openDropOff} onCancelled={reload} /> : null}
          {storage.openRequest ? (
            <PickupRequestCard request={storage.openRequest} onCancelled={reload} />
          ) : null}

          {canRequest ? (
            <View className="gap-1.5">
              <View className="flex-row gap-2">
                <Button
                  className="flex-1"
                  isDisabled={dropOffBlock !== null}
                  variant="secondary"
                  onPress={() => dropOffSheetRef.current?.present()}
                >
                  <Button.Label>Hẹn gửi đồ</Button.Label>
                </Button>
                <Button
                  className="flex-1"
                  isDisabled={block !== null}
                  variant="secondary"
                  onPress={() => sheetRef.current?.present()}
                >
                  <Button.Label>Hẹn lấy đồ</Button.Label>
                </Button>
              </View>
              {blockNote ? (
                <Text className="font-body text-caption text-muted">{blockNote}</Text>
              ) : null}
            </View>
          ) : null}

          {pastCount > 0 ? (
            <View className="gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: pastOpen }}
                onPress={() => setPastOpen((open) => !open)}
              >
                <Text className="font-strong text-body-sm text-accent">
                  Yêu cầu đã hủy ({pastCount}) {pastOpen ? '▴' : '▾'}
                </Text>
              </Pressable>
              {pastOpen ? (
                <>
                  {pastDropOffs.map((r) => (
                    <DropOffRequestCard key={r.id} request={r} />
                  ))}
                  {past.map((r) => (
                    <PickupRequestCard key={r.id} request={r} />
                  ))}
                </>
              ) : null}
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
          <RequestFormSheet sheetRef={dropOffSheetRef} onSubmitted={reload}>
            {(done) => (
              <DropOffRequestForm contractId={contract.id} items={storage.items} onDone={done} />
            )}
          </RequestFormSheet>
        </>
      ) : null}
    </SectionCard>
  );
}
