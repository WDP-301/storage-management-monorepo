import { Text, View } from 'react-native';
import {
  AREA_PRESETS,
  MAX_AMENITY_FILTER,
  PRICE_PRESETS,
  type RangePreset,
  SORT_OPTIONS,
  toggleAmenityId,
  VOLUME_PRESETS,
} from '../../../lib/warehouse-query';
import type { BrowseCriteria } from '../../types/customer';
import type { Amenity } from '../../types/storage-api';
import { ChipButton, FilterRow } from './FilterChips';
import type { LocationOption } from './location-options';

type Props = {
  criteria: BrowseCriteria;
  onChange: (criteria: BrowseCriteria) => void;
  /** Provinces that actually have available warehouses, so the list stays short. */
  provinceOptions: readonly LocationOption[];
  /** Wards within the selected province that have available warehouses. */
  wardOptions: readonly LocationOption[];
  /** Active catalog amenities; the row is hidden when empty. */
  amenityOptions: readonly Amenity[];
};

/**
 * Body of the filter sheet. Selections apply immediately — each one re-queries the server — and
 * the sheet's footer button reports the resulting count and closes.
 */
export function BrowseFiltersContent({
  criteria,
  onChange,
  provinceOptions,
  wardOptions,
  amenityOptions,
}: Props) {
  const update = (patch: Partial<BrowseCriteria>) => onChange({ ...criteria, ...patch });

  const presetRow = (
    label: string,
    presets: readonly RangePreset[],
    selected: string,
    field: 'areaPreset' | 'volumePreset' | 'pricePreset',
  ) => (
    <FilterRow label={label}>
      {presets.map((preset) => (
        <ChipButton
          key={preset.key}
          isSelected={selected === preset.key}
          label={preset.label}
          onPress={() => update({ [field]: preset.key })}
        />
      ))}
    </FilterRow>
  );

  return (
    <View className="gap-5 px-4">
      {provinceOptions.length === 0 ? (
        <View className="gap-1 rounded-xl bg-surface-secondary p-3">
          <Text className="font-strong text-body-md text-foreground">Khu vực tìm kho</Text>
          <Text className="font-body text-body-sm text-muted">
            Thông tin tỉnh thành và phường/xã của các kho đang được cập nhật. Bạn vẫn có thể lọc
            theo diện tích, thể tích và giá bên dưới.
          </Text>
        </View>
      ) : (
        <FilterRow label="Khu vực">
          <ChipButton
            isSelected={criteria.provinceCode === null}
            label="Tất cả"
            onPress={() => update({ provinceCode: null, wardCode: null })}
          />
          {provinceOptions.map((province) => (
            <ChipButton
              key={province.code}
              isSelected={criteria.provinceCode === province.code}
              label={`${province.name} (${province.count})`}
              onPress={() => update({ provinceCode: province.code, wardCode: null })}
            />
          ))}
        </FilterRow>
      )}

      {wardOptions.length > 1 ? (
        <FilterRow label="Phường / xã">
          <ChipButton
            isSelected={criteria.wardCode === null}
            label="Tất cả"
            onPress={() => update({ wardCode: null })}
          />
          {wardOptions.map((ward) => (
            <ChipButton
              key={ward.code}
              isSelected={criteria.wardCode === ward.code}
              label={`${ward.name} (${ward.count})`}
              onPress={() => update({ wardCode: ward.code })}
            />
          ))}
        </FilterRow>
      ) : null}

      {presetRow('Diện tích', AREA_PRESETS, criteria.areaPreset, 'areaPreset')}
      {presetRow('Thể tích', VOLUME_PRESETS, criteria.volumePreset, 'volumePreset')}
      {presetRow('Giá thuê / tháng', PRICE_PRESETS, criteria.pricePreset, 'pricePreset')}

      {amenityOptions.length > 0 ? (
        <FilterRow label="Tiện ích">
          {amenityOptions.map((amenity) => (
            <ChipButton
              key={amenity.id}
              isSelected={criteria.amenityIds.includes(amenity.id)}
              label={amenity.name}
              onPress={() =>
                update({ amenityIds: toggleAmenityId(criteria.amenityIds, amenity.id) })
              }
            />
          ))}
          {criteria.amenityIds.length >= MAX_AMENITY_FILTER ? (
            // Chips cannot be disabled, so say why an extra tap does nothing.
            <Text className="w-full font-body text-body-sm text-muted">
              Tối đa {MAX_AMENITY_FILTER} tiện ích
            </Text>
          ) : null}
        </FilterRow>
      ) : null}

      <FilterRow label="Sắp xếp">
        {SORT_OPTIONS.map((option) => (
          <ChipButton
            key={option.key}
            isSelected={criteria.sort === option.key}
            label={option.label}
            onPress={() => update({ sort: option.key })}
          />
        ))}
      </FilterRow>
    </View>
  );
}
