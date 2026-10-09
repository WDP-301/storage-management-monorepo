import { Text, View } from 'react-native';
import type { AreaPresetKey, BrowseCriteria } from '../../types/customer';
import { AREA_PRESETS, MAX_UNITS_PER_BOOKING, PRICE_PRESETS } from './browse-filters';
import { ChipButton, FilterRow, isNarrowingChipVisible, withCount } from './FilterChips';
import type { LocationOption } from './location-options';

type Props = {
  criteria: BrowseCriteria;
  onChange: (criteria: BrowseCriteria) => void;
  /** Provinces that actually have available units, so the list stays short. */
  provinceOptions: readonly LocationOption[];
  /** Wards within the selected province that have available units. */
  wardOptions: readonly LocationOption[];
  /** Units each area bucket would yield, with the other filters applied. */
  areaCounts: ReadonlyMap<AreaPresetKey, number>;
  /** Units each budget bucket would yield, with the other filters applied. */
  priceCounts: ReadonlyMap<number | null, number>;
};

/**
 * Body of the filter sheet. Selections apply immediately; the sheet's footer button only reports
 * the resulting count and closes.
 *
 * Area and budget chips carry their match count and disappear when they would yield nothing, so
 * the customer never taps a bucket that leads to an empty list.
 */
export function BrowseFiltersContent({
  criteria,
  onChange,
  provinceOptions,
  wardOptions,
  areaCounts,
  priceCounts,
}: Props) {
  const update = (patch: Partial<BrowseCriteria>) => onChange({ ...criteria, ...patch });

  // "Tất cả" carries the unfiltered total, so it doubles as the yardstick for which buckets
  // actually narrow anything. Its own count is left off the chip — the footer button already
  // reports that number.
  const areaTotal = areaCounts.get('any') ?? 0;
  const areaOptions = AREA_PRESETS.filter(
    (preset) =>
      preset.key !== 'any' &&
      isNarrowingChipVisible(
        areaCounts.get(preset.key) ?? 0,
        areaTotal,
        criteria.areaPreset === preset.key,
      ),
  );

  const priceTotal = priceCounts.get(null) ?? 0;
  const priceOptions = PRICE_PRESETS.filter(
    (preset) =>
      preset.maxMonthlyPrice !== null &&
      isNarrowingChipVisible(
        priceCounts.get(preset.maxMonthlyPrice) ?? 0,
        priceTotal,
        criteria.maxMonthlyPrice === preset.maxMonthlyPrice,
      ),
  );

  return (
    <View className="gap-5 px-4">
      <FilterRow label="Số kho cần thuê đồng thời">
        {Array.from({ length: MAX_UNITS_PER_BOOKING }, (_, index) => index + 1).map((quantity) => (
          <ChipButton
            key={quantity}
            isSelected={criteria.requestedQuantity === quantity}
            label={`${quantity} kho`}
            onPress={() => update({ requestedQuantity: quantity })}
          />
        ))}
      </FilterRow>
      {provinceOptions.length === 0 ? (
        <View className="gap-1 rounded-xl bg-surface-secondary p-3">
          <Text className="font-strong text-body-md text-foreground">Khu vực tìm kho</Text>
          <Text className="font-body text-body-sm text-muted">
            Thông tin tỉnh thành và phường/xã của các cơ sở đang được cập nhật. Bạn vẫn có thể lọc
            theo kích thước và giá bên dưới.
          </Text>
        </View>
      ) : null}
      {provinceOptions.length > 0 ? (
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
              label={province.name}
              onPress={() => update({ provinceCode: province.code, wardCode: null })}
            />
          ))}
        </FilterRow>
      ) : null}

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
              label={ward.name}
              onPress={() => update({ wardCode: ward.code })}
            />
          ))}
        </FilterRow>
      ) : null}

      {areaOptions.length > 0 ? (
        <FilterRow label="Kích thước">
          <ChipButton
            isSelected={criteria.areaPreset === 'any'}
            label="Tất cả"
            onPress={() => update({ areaPreset: 'any' })}
          />
          {areaOptions.map((preset) => (
            <ChipButton
              key={preset.key}
              isSelected={criteria.areaPreset === preset.key}
              label={withCount(preset.label, areaCounts.get(preset.key) ?? 0)}
              onPress={() => update({ areaPreset: preset.key })}
            />
          ))}
        </FilterRow>
      ) : null}

      {priceOptions.length > 0 ? (
        <FilterRow label="Ngân sách mỗi kho / tháng">
          <ChipButton
            isSelected={criteria.maxMonthlyPrice === null}
            label="Tất cả"
            onPress={() => update({ maxMonthlyPrice: null })}
          />
          {priceOptions.map((preset) => (
            <ChipButton
              key={preset.label}
              isSelected={criteria.maxMonthlyPrice === preset.maxMonthlyPrice}
              label={withCount(preset.label, priceCounts.get(preset.maxMonthlyPrice) ?? 0)}
              onPress={() => update({ maxMonthlyPrice: preset.maxMonthlyPrice })}
            />
          ))}
        </FilterRow>
      ) : null}
    </View>
  );
}
