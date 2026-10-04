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
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [waitlistedFacilityId, setWaitlistedFacilityId] = useState<string | null>(null);
  const filtersSheetRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<ScrollView>(null);

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
  const pageSize = mode === 'recommended' ? 5 : 10;
  const resultCount = mode === 'recommended' ? visibleFacilities.length : visibleUnitCount;
  const pageCount = Math.max(1, Math.ceil(resultCount / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedFacilities = useMemo(() => {
    if (mode === 'recommended') {
      return visibleFacilities.slice(pageStart, pageStart + pageSize);
    }
    // Page individual units, retaining their facility headers and the full selection elsewhere.
    let offset = 0;
    return visibleFacilities.flatMap((facility) => {
      const start = Math.max(0, pageStart - offset);
      const end = Math.min(facility.units.length, pageStart + pageSize - offset);
      offset += facility.units.length;
      return end > start ? [{ ...facility, units: facility.units.slice(start, end) }] : [];
    });
  }, [mode, pageStart, pageSize, visibleFacilities]);

  const changeCriteria = (next: typeof criteria) => {
    setCriteria(next);
    setPage(1);
  };
  const changePage = (next: number) => {
    setPage(Math.max(1, Math.min(next, pageCount)));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View className="flex-1">
      <ScrollView
        ref={scrollRef}
        className="flex-1"
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
          onChange={changeCriteria}
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
              onModeChange={(next) => {
                setMode(next);
                setPage(1);
              }}
            />

            {visibleFacilities.length === 0 ? (
              <EmptyState isFilteredOut={facilities.length > 0} />
            ) : (
              <View className="gap-4 px-4">
                {pagedFacilities.map((facility) =>
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
            {resultCount > 0 ? (
              <View className="gap-3 px-4 pt-5">
                <Text className="text-center text-xs text-muted">
                  Hiển thị {pageStart + 1}–{Math.min(pageStart + pageSize, resultCount)} /{' '}
                  {resultCount} {mode === 'recommended' ? 'nhóm cơ sở' : 'kho'}
                </Text>
                {pageCount > 1 ? (
                  <View className="flex-row items-center justify-between gap-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={currentPage === 1}
                      onPress={() => changePage(currentPage - 1)}
                    >
                      <Button.Label>Trang trước</Button.Label>
                    </Button>
                    <Text className="text-sm font-semibold text-foreground">
                      {currentPage} / {pageCount}
                    </Text>
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={currentPage === pageCount}
                      onPress={() => changePage(currentPage + 1)}
                    >
                      <Button.Label>Trang sau</Button.Label>
                    </Button>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {mode === 'manual' && selectedUnits.length > 0 && !isInitialLoading ? (
        <View className="shrink-0 border-t border-border bg-background px-4 py-3">
          <Card className="border border-accent/30 bg-accent/5">
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
        </View>
      ) : null}

      <BrowseFiltersSheet
        areaCounts={areaCounts}
        criteria={criteria}
        priceCounts={priceCounts}
        provinceOptions={provinceOptions}
        resultCount={visibleUnitCount}
        sheetRef={filtersSheetRef}
        wardOptions={wardOptions}
        onChange={changeCriteria}
      />
    </View>
  );
}
