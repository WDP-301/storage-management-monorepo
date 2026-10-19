import { LayerCard } from '@cloudflare/kumo';
import React from 'react';
import type { WarehouseAmenity } from '../../types/amenity';

interface Props {
  amenities: WarehouseAmenity[] | undefined;
}

export const WarehouseAmenitiesCard: React.FC<Props> = ({ amenities = [] }) => (
  <LayerCard className="p-4 ring ring-kumo-line space-y-2">
    <h2 className="text-sm font-semibold text-kumo-default">Tiện ích có sẵn</h2>
    {amenities.length === 0 ? (
      <p className="text-sm text-kumo-subtle">Chưa khai báo tiện ích.</p>
    ) : (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        {amenities.map((a) => (
          <li key={a.amenityId} className="text-kumo-default">
            <span className="font-medium">
              {a.name} ×{a.quantity}
            </span>
            {a.note && <span className="text-kumo-subtle"> — {a.note}</span>}
          </li>
        ))}
      </ul>
    )}
  </LayerCard>
);
