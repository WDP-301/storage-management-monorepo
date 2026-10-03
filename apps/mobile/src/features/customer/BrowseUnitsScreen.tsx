import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button, Card } from 'heroui-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { formatMoney } from '../../../lib/format-vi';
import type { BrowseMode, UnitOffer } from '../../types/customer';
import { ManualFacilityCard, RecommendedFacilityCard } from './BrowseFacilityCards';
import { BrowseFiltersBar } from './BrowseFiltersBar';
import { BrowseFiltersSheet } from './BrowseFiltersSheet';
import { BrowseListHeader } from './BrowseListHeader';
import { EmptyState, ErrorState, LoadingState } from './BrowseStates';
import {
  applyBrowseFilters,
  countAreaPresetMatches,
  countPricePresetMatches,
  DEFAULT_BROWSE_CRITERIA,
  pruneStaleLocationCodes,
} from './browse-filters';
import { buildProvinceOptions, buildWardOptions } from './location-options';
import { sumUnitPrices } from './unit-offer-utils';
import { useAvailableUnits } from './use-available-units';
import { useWards } from './use-wards';

type Props = {
  hasHolding: boolean;
  contentBottomPadding: number;
  onHold: (units: UnitOffer[]) => void;
};

export function BrowseUnitsScreen({ hasHolding, contentBottomPadding, onHold }: Props) {
  const { facilities, provinces, hasMore, isLoading, error, refetch } = useAvailableUnits();
  const [criteria, setCriteria] = useState(DEFAULT_BROWSE_CRITERIA);
  const [mode, setMode] = useState<BrowseMode>('recommended');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [waitlistedFacilityId, setWaitlistedFacilityId] = useState<string | null>(null);
  const filtersSheetRef = useRef<BottomSheetModal>(null);

  const provinceOptions = useMemo(
    () => buildProvinceOptions(facilities, provinces),
    [facilities, provinces],
  );

  // With a single province the picker is hidden, but its wards still need to be filterable —
  // which is the common case of one city holding every facility.
  const effectiveProvinceCode =
    criteria.provinceCode ?? (provinceOptions.length === 1 ? provinceOptions[0].code : null);

  const wardNames = useWards(effectiveProvinceCode);
  const wardOptions = useMemo(
    () => buildWardOptions(facilities, effectiveProvinceCode, wardNames),
    [facilities, effectiveProvinceCode, wardNames],
  );
  const visibleFacilities = useMemo(
    () => applyBrowseFilters(facilities, criteria),
    [facilities, criteria],
  );
  const areaCounts = useMemo(
    () => countAreaPresetMatches(facilities, criteria),
    [facilities, criteria],
  );
  const priceCounts = useMemo(
    () => countPricePresetMatches(facilities, criteria),
    [facilities, criteria],
  );

  // A refresh keeps the current list on screen; only a first load blanks it out.
  const hasData = facilities.length > 0;
  const isInitialLoading = isLoading && !hasData;
  const isRefreshing = isLoading && hasData;

  // Location codes outlive the data they came from, so a reload can leave a filter active with no
  // chip to switch it off. Re-running on every options change converges: once pruned, the codes
  // are valid and this returns the criteria untouched.
  useEffect(() => {
    setCriteria((current) => pruneStaleLocationCodes(current, provinceOptions, wardOptions));
  }, [provinceOptions, wardOptions]);

  // Drop selections that the current filters hide or that exceed the requested quantity.
  useEffect(() => {
    const visibleIds = new Set(
      visibleFacilities.flatMap((facility) => facility.units.map((unit) => unit.id)),
    );
    setSelectedIds((current) => {
      const next = current.filter((id) => visibleIds.has(id)).slice(0, criteria.requestedQuantity);
      return next.length === current.length ? current : next;
    });
  }, [visibleFacilities, criteria.requestedQuantity]);

  const selectedUnits = visibleFacilities
    .flatMap((facility) => facility.units)
    .filter((unit) => selectedIds.includes(unit.id));
  const selectedFacilityCount = new Set(selectedUnits.map((unit) => unit.facilityId)).size;

  const toggleUnit = (unit: UnitOffer) => {
    setSelectedIds((current) => {
      if (current.includes(unit.id)) return current.filter((id) => id !== unit.id);
      if (current.length >= criteria.requestedQuantity) return current;
      return [...current, unit.id];
    });
  };

  const visibleUnitCount = visibleFacilities.reduce(
    (total, facility) => total + facility.units.length,
    0,
  );

  return (
    <>
      <ScrollView
        contentContainerStyle={{ paddingBottom: contentBottomPadding }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} />}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pb-4 pt-5">
          <Text className="text-2xl font-bold tracking-tight text-foreground">Tìm kho phù hợp</Text>
          <Text className="mt-1 text-sm leading-5 text-muted">
            Đặt nhiều kho trong một lượt, ưu tiên đủ kho tại cùng cơ sở.
          </Text>
        </View>

        <BrowseFiltersBar
          criteria={criteria}
          provinceOptions={provinceOptions}
          wardOptions={wardOptions}
          onChange={setCriteria}
          onOpenFilters={() => filtersSheetRef.current?.present()}
        />

        {isInitialLoading ? <LoadingState /> : null}
        {/* A failed refresh keeps the stale list below, so the error sits above it rather than
          replacing everything the customer was already looking at. */}
        {error ? <ErrorState message={error} onRetry={refetch} /> : null}

        {!isInitialLoading && !(error && !hasData) ? (
          <>
            <BrowseListHeader
              facilityCount={visibleFacilities.length}
              hasMore={hasMore}
              mode={mode}
              onModeChange={setMode}
            />

            {visibleFacilities.length === 0 ? (
              <EmptyState isFilteredOut={facilities.length > 0} />
            ) : (
              <View className="gap-4 px-4">
                {visibleFacilities.map((facility) =>
                  mode === 'recommended' ? (
                    <RecommendedFacilityCard
                      key={facility.id}
                      facility={facility}
                      hasHolding={hasHolding}
                      requestedQuantity={criteria.requestedQuantity}
                      waitlisted={waitlistedFacilityId === facility.id}
                      onHold={onHold}
                      onWaitlist={() => setWaitlistedFacilityId(facility.id)}
                    />
                  ) : (
                    <ManualFacilityCard
                      key={facility.id}
                      facility={facility}
                      hasHolding={hasHolding}
                      requestedQuantity={criteria.requestedQuantity}
                      selectedIds={selectedIds}
                      onToggle={toggleUnit}
                    />
                  ),
                )}
              </View>
            )}

            {mode === 'manual' && visibleFacilities.length > 0 ? (
              <Card className="mx-4 mt-4 border border-accent/30 bg-accent/5">
                <Card.Body className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-foreground">
                      Đã chọn {selectedUnits.length}/{criteria.requestedQuantity} kho
                    </Text>
                    <Text className="text-sm font-semibold text-accent">
                      {formatMoney(sumUnitPrices(selectedUnits, 'monthlyPrice'))}/tháng
                    </Text>
                  </View>
                  {selectedFacilityCount > 1 ? (
                    <Text className="text-xs leading-5 text-muted">
                      Các kho thuộc {selectedFacilityCount} cơ sở. Chọn cùng một cơ sở để thuận tiện
                      hơn.
                    </Text>
                  ) : null}
                  <Button
                    isDisabled={selectedUnits.length !== criteria.requestedQuantity || hasHolding}
                    onPress={() => onHold(selectedUnits)}
                  >
                    <Button.Label>Chọn {criteria.requestedQuantity} kho đã chọn</Button.Label>
                  </Button>
                </Card.Body>
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <BrowseFiltersSheet
        areaCounts={areaCounts}
        criteria={criteria}
        priceCounts={priceCounts}
        provinceOptions={provinceOptions}
        resultCount={visibleUnitCount}
        sheetRef={filtersSheetRef}
        wardOptions={wardOptions}
        onChange={setCriteria}
      />
    </>
  );
}
