import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Faders, MagnifyingGlass, X } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { hasPlottableCoords } from '../../../lib/goong-map-config';
import { type PlacePrediction, PlacesApi } from '../../../lib/places-api';
import type { BrowseMode, BrowseView, FacilityOffer, UnitOffer } from '../../types/customer';
import { BrowseFiltersBar } from './BrowseFiltersBar';
import { BrowseFiltersSheet } from './BrowseFiltersSheet';
import { BrowseBrandHeader, BrowseLocationControls } from './BrowseHeader';
import { BrowseMapView } from './BrowseMapView';
import { BrowseResultsList } from './BrowseResultsList';
import { BrowseSelectionBar } from './BrowseSelectionBar';
import { ErrorState, LoadingState } from './BrowseStates';
import { FacilityMapSheet } from './FacilityMapSheet';
import { MapPlaceSearchSheet } from './MapPlaceSearchSheet';
import { useAvailableUnits } from './use-available-units';
import { useBrowseCriteria } from './use-browse-criteria';

type Props = {
  hasHolding: boolean;
  contentBottomPadding: number;
  onHold: (units: UnitOffer[]) => void;
};

type NearbySearch = {
  label: string;
  center: { lat: number; lng: number };
  facilityIds: string[];
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
  const [mapFacilityId, setMapFacilityId] = useState<string | null>(null);
  const [nearbySearch, setNearbySearch] = useState<NearbySearch | null>(null);
  const nearbyIds = nearbySearch ? new Set(nearbySearch.facilityIds) : null;
  const mapFacilities = nearbyIds
    ? visibleFacilities.filter((facility) => nearbyIds.has(facility.id))
    : visibleFacilities;
  const mapFacility = mapFacilities.find((facility) => facility.id === mapFacilityId) ?? null;
  const filtersSheetRef = useRef<BottomSheetModal>(null);
  const facilitySheetRef = useRef<BottomSheetModal>(null);
  const pendingMapHoldRef = useRef<UnitOffer[] | null>(null);
  const placeSearchSheetRef = useRef<BottomSheetModal>(null);
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
    setMapFacilityId(null);
    facilitySheetRef.current?.dismiss();
  };
  const changePage = (next: number) => {
    setPage(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const openFacility = (facility: FacilityOffer) => {
    setMapFacilityId(facility.id);
  };
  const continueFromMap = (units: UnitOffer[]) => {
    if (pendingMapHoldRef.current) return;
    // Navigate only after the modal is fully gone; it lives above the tab navigator.
    pendingMapHoldRef.current = units;
    facilitySheetRef.current?.dismiss();
  };
  const dismissFacility = () => {
    setMapFacilityId(null);
    const units = pendingMapHoldRef.current;
    pendingMapHoldRef.current = null;
    if (units) onHold(units);
  };
  useEffect(() => {
    if (view === 'map' && mapFacilityId && mapFacility) {
      facilitySheetRef.current?.present();
    }
  }, [view, mapFacilityId, mapFacility?.id]);
  const choosePlace = async (place: PlacePrediction) => {
    const result = await PlacesApi.nearby(place.place_id);
    setNearbySearch({
      label: place.structured_formatting?.main_text ?? place.description,
      center: result.center,
      facilityIds: result.facilities.map((facility) => facility.id),
    });
    setMapFacilityId(null);
    facilitySheetRef.current?.dismiss();
  };

  const location =
    provinceOptions.find((option) => option.code === criteria.provinceCode)?.name ??
    (provinceOptions.length === 1 ? provinceOptions[0].name : 'Tất cả cơ sở');
  const openFilters = () => filtersSheetRef.current?.present();

  // The same operational controls serve both list and map views.
  const header = (
    <View className="bg-surface">
      <BrowseLocationControls
        location={location}
        criteria={criteria}
        facilities={facilities}
        wards={wardOptions}
        view={view}
        plottableCount={plottableCount}
        onView={setView}
        onChange={changeCriteria}
        onOpenFilters={openFilters}
      />
      {view === 'list' ? <BrowseFiltersBar criteria={criteria} onChange={changeCriteria} /> : null}
    </View>
  );

  return (
    <View className="flex-1">
      <BrowseBrandHeader location={location} onLocation={openFilters} />
      {view === 'map' ? (
        // Outside the ScrollView on purpose: a ScrollView swallows the map's pan and zoom gestures.
        <>
          {header}
          {isInitialLoading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} onRetry={refetch} /> : null}
          <View className="mt-3 flex-1">
            <BrowseMapView
              facilities={mapFacilities}
              searchCenter={nearbySearch?.center ?? null}
              selectedFacilityId={mapFacility?.id ?? null}
              onSelect={openFacility}
            />
            <View className="absolute top-3 right-4 left-4 gap-2" pointerEvents="box-none">
              <View className="flex-row items-center rounded-full border border-border bg-surface shadow-sm">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tìm kho gần địa điểm"
                  className="min-h-11 flex-1 flex-row items-center gap-2 px-3"
                  onPress={() => placeSearchSheetRef.current?.present()}
                >
                  <MagnifyingGlass color="#006398" size={18} weight="bold" />
                  <Text className="flex-1 font-ui text-body-sm text-foreground" numberOfLines={1}>
                    {nearbySearch?.label ?? 'Tìm kho gần địa điểm...'}
                  </Text>
                </Pressable>
                {nearbySearch ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Xóa địa điểm tìm kiếm"
                    className="size-11 items-center justify-center"
                    onPress={() => {
                      setNearbySearch(null);
                      setMapFacilityId(null);
                    }}
                  >
                    <X color="#64748b" size={18} />
                  </Pressable>
                ) : null}
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Lọc bản đồ, ${criteria.requestedQuantity} kho, kích thước ${criteria.areaPreset === 'any' ? 'tất cả' : criteria.areaPreset}`}
                  className="self-start flex-row items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 shadow-sm"
                  onPress={openFilters}
                >
                  <Faders color="#006398" size={17} weight="bold" />
                  <Text className="font-ui text-body-sm text-foreground">
                    {criteria.requestedQuantity} kho ·{' '}
                    {criteria.areaPreset === 'any'
                      ? 'Mọi kích thước'
                      : criteria.areaPreset === 'small'
                        ? 'Nhỏ'
                        : criteria.areaPreset === 'medium'
                          ? 'Vừa'
                          : 'Lớn'}
                  </Text>
                </Pressable>
                {selectedUnits.length > 0 ? (
                  <Text className="rounded-full bg-foreground px-2.5 py-2 font-ui text-caption text-surface">
                    Đã chọn {selectedUnits.length}/{criteria.requestedQuantity}
                  </Text>
                ) : null}
                {nearbySearch ? (
                  <Text className="rounded-full bg-surface px-2.5 py-2 font-ui text-caption text-foreground">
                    {mapFacilities.length} cơ sở · 5 km
                  </Text>
                ) : null}
              </View>
            </View>
            {nearbySearch && mapFacilities.length === 0 ? (
              <View className="absolute top-28 right-4 left-4 rounded-xl bg-surface p-3">
                <Text className="font-body text-body-sm text-foreground">
                  Không có kho trống phù hợp trong 5 km. Thử địa điểm khác hoặc xóa tìm kiếm.
                </Text>
              </View>
            ) : null}
            <FacilityMapSheet
              facility={mapFacility}
              hasHolding={hasHolding}
              requestedQuantity={criteria.requestedQuantity}
              selectedIds={selectedIds}
              allSelectedUnits={selectedUnits}
              sheetRef={facilitySheetRef}
              onDismiss={dismissFacility}
              onHold={continueFromMap}
              onToggle={(unit) => {
                setMode('manual');
                toggleUnit(unit);
              }}
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
      <MapPlaceSearchSheet sheetRef={placeSearchSheetRef} onChoose={choosePlace} />
    </View>
  );
}
