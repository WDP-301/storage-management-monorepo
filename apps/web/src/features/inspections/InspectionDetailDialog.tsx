import { Dialog } from '@cloudflare/kumo';
import type React from 'react';
import { DIALOG_SHELL } from '../../components/dialog-layout';
import type { InspectionRecord } from '../../types/inspection';
import { InspectionDetailView } from './InspectionDetailView';

interface Props {
  inspection: InspectionRecord | null;
  onClose: () => void;
  /** Called after an assign or finalize so the page can reload. */
  onChanged: () => void;
}

/** An inspection record in its own dialog, as opened from the inspections page. */
export const InspectionDetailDialog: React.FC<Props> = ({ inspection, onClose, onChanged }) => {
  if (!inspection) return null;
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog size="xl" className={`${DIALOG_SHELL} max-w-2xl sm:w-[640px] w-full`}>
        <InspectionDetailView inspection={inspection} onClose={onClose} onChanged={onChanged} />
      </Dialog>
    </Dialog.Root>
  );
};
