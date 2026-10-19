import type React from 'react';
import type { ContractAmenity } from '../../types/contract';
import type { StorageUnitKind } from '../../types/warehouse';
import { AmenityItems } from '../warehouses/WarehouseAmenitiesCard';

interface Props {
  amenities: ContractAmenity[] | null;
  unitKind?: StorageUnitKind;
}

/**
 * Amenities copied into the contract at creation. null means none were recorded: the contract predates the
 * snapshot, or it was created later for an old booking whose original equipment is no longer known.
 */
export const ContractAmenitiesSection: React.FC<Props> = ({ amenities, unitKind }) => (
  <section className="space-y-2">
    <span className="text-xs font-semibold text-kumo-default block">Tiện ích kèm theo</span>
    {amenities === null ? (
      <p className="text-sm text-kumo-subtle">
        Chưa ghi nhận — hệ thống không có danh sách tiện ích tại thời điểm bắt đầu thuê.
      </p>
    ) : amenities.length === 0 ? (
      <p className="text-sm text-kumo-subtle">Kho không có tiện ích nào khi lập hợp đồng.</p>
    ) : (
      <>
        <AmenityItems amenities={amenities} />
        {unitKind === 'SHELF' && (
          <p className="text-xs text-kumo-subtle">Tiện ích chung của toà nhà kho kệ.</p>
        )}
      </>
    )}
  </section>
);
