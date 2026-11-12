import { Button } from '@cloudflare/kumo';
import type React from 'react';
import { useState } from 'react';
import { ShelfDropOffRequestsPanel } from './ShelfDropOffRequestsPanel';
import { ShelfPickupRequestsPanel } from './ShelfPickupRequestsPanel';
import { ShelfReceiptDetailDialog } from './ShelfReceiptDetailDialog';
import { ShelfReceiptsPanel } from './ShelfReceiptsPanel';
import { ShelfStockPanel } from './ShelfStockPanel';

type View = 'stock' | 'receipts' | 'requests' | 'dropOffs';

const VIEWS: { id: View; label: string }[] = [
  { id: 'stock', label: 'Đồ trên kệ' },
  { id: 'receipts', label: 'Phiếu gửi / lấy' },
  { id: 'requests', label: 'Yêu cầu lấy đồ' },
  { id: 'dropOffs', label: 'Yêu cầu gửi đồ' },
];

/** Back-office record of what customers keep on the shelves of one shelf warehouse. */
export const ShelfRecordsTab: React.FC<{ warehouseId: string }> = ({ warehouseId }) => {
  const [view, setView] = useState<View>('stock');
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [requestScope, setRequestScope] = useState<'OPEN' | 'ALL'>('OPEN');
  const [dropOffScope, setDropOffScope] = useState<'OPEN' | 'ALL'>('OPEN');
  // Bumped after a void: the stock and the receipt list behind the dialog both changed.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Button
            key={v.id}
            size="sm"
            variant={view === v.id ? 'primary' : 'secondary'}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </Button>
        ))}
      </div>
      {view === 'stock' && <ShelfStockPanel warehouseId={warehouseId} refreshKey={refreshKey} />}
      {view === 'receipts' && (
        <ShelfReceiptsPanel
          warehouseId={warehouseId}
          refreshKey={refreshKey}
          onOpen={setReceiptId}
        />
      )}
      {view === 'requests' && (
        <ShelfPickupRequestsPanel
          warehouseId={warehouseId}
          refreshKey={refreshKey}
          scope={requestScope}
          onScopeChange={setRequestScope}
        />
      )}
      {view === 'dropOffs' && (
        <ShelfDropOffRequestsPanel
          warehouseId={warehouseId}
          refreshKey={refreshKey}
          scope={dropOffScope}
          onScopeChange={setDropOffScope}
        />
      )}
      <ShelfReceiptDetailDialog
        receiptId={receiptId}
        onClose={() => setReceiptId(null)}
        onChanged={() => setRefreshKey((n) => n + 1)}
      />
    </div>
  );
};
