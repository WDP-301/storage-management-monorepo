import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { ShelfItemView } from '@storage/types';
import type { RefObject } from 'react';
import { PickupRequestForm } from './PickupRequestForm';
import { RequestFormSheet } from './RequestFormSheet';

type Props = {
  sheetRef: RefObject<BottomSheetModal | null>;
  contractId: string;
  items: ShelfItemView[];
  onSubmitted: () => void;
};

/** Sheet for asking staff to prepare goods ahead of a visit. The form mounts with each opening. */
export function PickupRequestSheet({ sheetRef, contractId, items, onSubmitted }: Props) {
  return (
    <RequestFormSheet sheetRef={sheetRef} onSubmitted={onSubmitted}>
      {(done) => <PickupRequestForm contractId={contractId} items={items} onDone={done} />}
    </RequestFormSheet>
  );
}
