import { Button } from '@cloudflare/kumo';
import { Wrench } from '@phosphor-icons/react';
import type { Warehouse } from '../../../types/warehouse';

interface Props {
  warehouse: Warehouse;
  busy: boolean;
  onToggle: (w: Warehouse) => void;
}

/** Only an idle or maintained warehouse can switch; other statuses render nothing. */
export function MaintenanceToggleButton({ warehouse: w, busy, onToggle }: Props) {
  if (w.status !== 'AVAILABLE' && w.status !== 'MAINTENANCE') return null;
  return (
    <Button
      variant={w.status === 'MAINTENANCE' ? 'secondary' : 'outline'}
      size="sm"
      icon={<Wrench className="w-3.5 h-3.5" />}
      disabled={busy}
      onClick={() => onToggle(w)}
    >
      {w.status === 'MAINTENANCE' ? 'Mở lại kho' : 'Báo bảo trì'}
    </Button>
  );
}
