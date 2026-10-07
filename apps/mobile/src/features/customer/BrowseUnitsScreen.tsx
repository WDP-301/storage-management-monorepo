import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { hasPlottableCoords } from '../../../lib/goong-map-config';
import type { BrowseMode, BrowseView, FacilityOffer, UnitOffer } from '../../types/customer';
import { BrowseFiltersBar } from './BrowseFiltersBar';
import { BrowseFiltersSheet } from './BrowseFiltersSheet';
import { BrowseMapView } from './BrowseMapView';
import { BrowseResultsList } from './BrowseResultsList';
import { BrowseSelectionBar } from './BrowseSelectionBar';
import { ErrorState, LoadingState } from './BrowseStates';
import { BrowseViewToggle } from './BrowseViewToggle';
import { FacilityMapSheet } from './FacilityMapSheet';
import { useAvailableUnits } from './use-available-units';
import { useBrowseCriteria } from './use-browse-criteria';

type Props = {
  hasHolding: boolean;
  contentBottomPadding: number;
  onHold: (units: UnitOffer[]) => void;
};

export function BrowseUnitsScreen({ hasHolding, contentBottomPadding, onHold }: Props) {
  const { facilities, provinces, hasMore, isLoading, error, refetch } = useAvailableUnits();
  const {
    criteria,
    setCriteria,
    provinceOptions,
    wardOptions,
    visibleFacilities,
    areaCounts,
    priceCounts,
  } = useBrowseCriteria(facilities, provinces);
  const [mode, setMode] = useState<BrowseMode>('recommended');
  const [view, setView] = useState<BrowseView>('list');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [waitlistedFacilityId, setWaitlistedFacilityId] = useState<string | null>(null);
  // Kept separate from the sheet ref: the sheet needs data while animating out, so it reads the
  // last tapped facility rather than being unmounted on dismiss.
  const [mapFacility, setMapFacility] = useState<FacilityOffer | null>(null);
  const filtersSheetRef = useRef<BottomSheetModal>(null);
  const facilitySheetRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<ScrollView>(null);

  // A refresh keeps the current list on screen; only a first load blanks it out.
  const hasData = facilities.length > 0;
  const isInitialLoading = isLoading && !hasData;
  const isRefreshing = isLoading && hasData;

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
  const plottableCount = visibleFacilities.filter(hasPlottableCoords).length;

  const changeCriteria = (next: typeof criteria) => {
    setCriteria(next);
    setPage(1);
    // The tapped facility can fall outside the new filters, so close the sheet instead of
    // leaving stale details on screen.
    setMapFacility(null);
    facilitySheetRef.current?.dismiss();
  };
  const changePage = (next: number) => {
    setPage(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const openFacility = (facility: FacilityOffer) => {
    setMapFacility(facility);
    facilitySheetRef.current?.present();
  };

  // Shared by both views so the title, filters and the switch itself never diverge between them.
  const header = (
    <>
      <View className="px-4 pt-5 pb-4">
        <Text className="font-bold text-2xl text-foreground tracking-tight">Tìm kho phù hợp</Text>
        <Text className="mt-1 text-muted text-sm leading-5">
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
      <BrowseViewToggle plottableCount={plottableCount} view={view} onChange={setView} />
    </>
  );

  return (
    <View className="flex-1">
      {view === 'map' ? (
        // Outside the ScrollView on purpose: a ScrollView swallows the map's pan and zoom gestures.
        <>
          {header}
          <View className="mt-3 flex-1">
            <BrowseMapView
              facilities={visibleFacilities}
              selectedFacilityId={mapFacility?.id ?? null}
              onSelect={openFacility}
            />
          </View>
        </>
      ) : (
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: contentBottomPadding }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} />}
          showsVerticalScrollIndicator={false}
        >
          {header}
          {isInitialLoading ? <LoadingState /> : null}
          {/* A failed refresh keeps the stale list below, so the error sits above it rather than
            replacing everything the customer was already looking at. */}
          {error ? <ErrorState message={error} onRetry={refetch} /> : null}
          {!isInitialLoading && !(error && !hasData) ? (
            <BrowseResultsList
              facilities={visibleFacilities}
              hasHolding={hasHolding}
              hasMore={hasMore}
              mode={mode}
              page={page}
              requestedQuantity={criteria.requestedQuantity}
              selectedIds={selectedIds}
              totalFacilityCount={facilities.length}
              waitlistedFacilityId={waitlistedFacilityId}
              onHold={onHold}
              onModeChange={(next) => {
                setMode(next);
                setPage(1);
              }}
              onPageChange={changePage}
              onToggle={toggleUnit}
              onWaitlist={setWaitlistedFacilityId}
            />
          ) : null}
        </ScrollView>
      )}

      {view === 'list' && mode === 'manual' && selectedUnits.length > 0 && !isInitialLoading ? (
        <BrowseSelectionBar
          hasHolding={hasHolding}
          requestedQuantity={criteria.requestedQuantity}
          selectedUnits={selectedUnits}
          onHold={onHold}
        />
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
      <FacilityMapSheet
        facility={mapFacility}
        hasHolding={hasHolding}
        requestedQuantity={criteria.requestedQuantity}
        sheetRef={facilitySheetRef}
        onHold={onHold}
      />
    </View>
  );
}
