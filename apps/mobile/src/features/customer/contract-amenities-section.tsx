import { Text } from '../../components/ui';
import type { ApiContract } from '../../types/contract-api';
import { SectionCard } from './contract-sections';
import { AmenityItems } from './WarehouseAmenityList';

/** Amenities recorded on the contract at signing; distinguishes "not recorded" from "none". */
export function ContractAmenitiesSection({ contract }: { contract: ApiContract }) {
  const { amenities } = contract;
  // A shelf is rented inside a shared building, so its amenities belong to the building.
  const title =
    contract.unit?.kind === 'SHELF' ? 'Tiện ích chung của toà nhà' : 'Tiện ích kèm theo';

  if (amenities === null) {
    return (
      <SectionCard title={title} badge="Chưa ghi nhận" tone="neutral">
        <Text className="text-body-sm text-text-secondary">
          Hệ thống không có danh sách tiện ích tại thời điểm bắt đầu thuê. Liên hệ chi nhánh nếu
          cần.
        </Text>
      </SectionCard>
    );
  }

  if (amenities.length === 0) return null;

  return (
    <SectionCard title={title} badge={`${amenities.length} mục`} tone="accent">
      <AmenityItems amenities={amenities} />
    </SectionCard>
  );
}
