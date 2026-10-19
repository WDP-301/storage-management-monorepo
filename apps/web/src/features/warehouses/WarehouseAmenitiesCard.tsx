import { Badge, LayerCard } from '@cloudflare/kumo';
import React from 'react';
import type { WarehouseAmenity } from '../../types/amenity';

export interface AmenityLine {
  amenityId: string;
  name: string;
  quantity: number;
  note: string | null;
  isActive?: boolean;
}

interface ItemsProps {
  amenities: readonly AmenityLine[];
  /** Flag retired catalog entries; off for contract snapshots, which are history. */
  markRetired?: boolean;
}

export const AmenityItems: React.FC<ItemsProps> = ({ amenities, markRetired = false }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
    {amenities.map((a) => (
      <li key={a.amenityId} className="text-kumo-default">
        <span className="font-medium">
          {a.name} ×{a.quantity}
        </span>
        {a.note && <span className="text-kumo-subtle"> — {a.note}</span>}
        {markRetired && a.isActive === false && (
          <Badge variant="neutral" className="ml-2">
            Ngừng dùng
          </Badge>
        )}
      </li>
    ))}
  </ul>
);

interface Props {
  amenities: WarehouseAmenity[] | undefined;
}

export const WarehouseAmenitiesCard: React.FC<Props> = ({ amenities = [] }) => (
  <LayerCard className="p-4 ring ring-kumo-line space-y-2">
    <h2 className="text-sm font-semibold text-kumo-default">Tiện ích có sẵn</h2>
    {amenities.length === 0 ? (
      <p className="text-sm text-kumo-subtle">Chưa khai báo tiện ích.</p>
    ) : (
      <AmenityItems amenities={amenities} markRetired />
    )}
  </LayerCard>
);
