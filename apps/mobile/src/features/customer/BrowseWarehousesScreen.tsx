import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { hasPlottableCoords } from '../../../lib/goong-map-config';
import { type PlacePrediction, PlacesApi } from '../../../lib/places-api';
import {
  countActiveFilters,
  MAX_WAREHOUSES_PER_BOOKING,
  matchesCriteria,
} from '../../../lib/warehouse-query';
import type { BrowseView } from '../../types/customer';
import type { NearbyWarehouse, Warehouse } from '../../types/storage-api';
import { BrowseFiltersSheet } from './BrowseFiltersSheet';
import { BrowseBrandHeader, BrowseLocationControls } from './BrowseHeader';
import { BrowseMapOverlay } from './BrowseMapOverlay';
import { BrowseMapView } from './BrowseMapView';
import { BrowseQuickFilters } from './BrowseQuickFilters';
import { BrowseResultsList } from './BrowseResultsList';
import { BrowseSelectionBar } from './BrowseSelectionBar';
import { ErrorState, LoadingState } from './BrowseStates';
import { MapPlaceSearchSheet } from './MapPlaceSearchSheet';
import { useBrowseCriteria } from './use-browse-criteria';
import { useWarehouses } from './use-warehouses';
import { WarehouseMapSheet } from './WarehouseMapSheet';

type Props = {
  hasHolding: boolean;
  contentBottomPadding: number;
  onHold: (warehouses: Warehouse[]) => void;
};

type NearbySearch = {
  label: string;
  center: { lat: number; lng: number };
  warehouses: NearbyWarehouse[];
};

export function BrowseWarehousesScreen({ hasHolding, contentBottomPadding, onHold }: Props) {
  const { criteria, setCriteria, provinceOptions, wardOptions } = useBrowseCriteria();
  const { warehouses, total, hasMore, isLoading, isLoadingMore, error, loadMore, refetch } =
    useWarehouses(criteria);
  const [view, setView] = useState<BrowseView>('list');
  const [selected, setSelected] = useState<Warehouse[]>([]);
  const [mapWarehouseId, setMapWarehouseId] = useState<string | null>(null);
  const [nearbySearch, setNearbySearch] = useState<NearbySearch | null>(null);
  const filtersSheetRef = useRef<BottomSheetModal>(null);
  const warehouseSheetRef = useRef<BottomSheetModal>(null);
  const placeSearchSheetRef = useRef<BottomSheetModal>(null);
  const pendingContinueRef = useRef(false);

  // A nearby search replaces the paged list on the map; it has no server filters, so the same
  // criteria are applied here.
  const mapWarehouses: readonly Warehouse[] = nearbySearch
    ? nearbySearch.warehouses.filter((warehouse) => matchesCriteria(warehouse, criteria))
    : warehouses;
  const mapWarehouse = mapWarehouses.find((warehouse) => warehouse.id === mapWarehouseId) ?? null;
  const selectedIds = selected.map((warehouse) => warehouse.id);
  const activeFilterCount = countActiveFilters(criteria);

  // A refresh keeps the current list on screen; only a first load blanks it out.
  const hasData = warehouses.length > 0;
  const isInitialLoading = isLoading && !hasData;
  const isRefreshing = isLoading && hasData;

  const toggleWarehouse = (warehouse: Warehouse) => {
    setSelected((current) => {
      if (current.some((item) => item.id === warehouse.id)) {
        return current.filter((item) => item.id !== warehouse.id);
      }
      return current.length >= MAX_WAREHOUSES_PER_BOOKING ? current : [...current, warehouse];
    });
  };

  const changeCriteria = (next: typeof criteria) => {
    setCriteria(next);
    setMapWarehouseId(null);
    warehouseSheetRef.current?.dismiss();
  };

  const continueFromMap = () => {
    if (pendingContinueRef.current || selected.length === 0) return;
    // Navigate only after the modal is fully gone; it lives above the tab navigator.
    pendingContinueRef.current = true;
    warehouseSheetRef.current?.dismiss();
  };
  const dismissWarehouse = () => {
    setMapWarehouseId(null);
    if (!pendingContinueRef.current) return;
    pendingContinueRef.current = false;
    onHold(selected);
  };
  useEffect(() => {
    if (view === 'map' && mapWarehouse) warehouseSheetRef.current?.present();
  }, [view, mapWarehouse]);

  const choosePlace = async (place: PlacePrediction) => {
    const result = await PlacesApi.nearby(place.place_id);
    setNearbySearch({
      label: place.structured_formatting?.main_text ?? place.description,
      center: result.center,
      warehouses: result.warehouses,
    });
    setMapWarehouseId(null);
    warehouseSheetRef.current?.dismiss();
  };

  const selectedProvince = provinceOptions.find((option) => option.code === criteria.provinceCode);
  const location =
    selectedProvince?.name ??
    (provinceOptions.length === 1 ? provinceOptions[0].name : 'Tất cả kho');
  const provinceCount = selectedProvince?.count ?? provinceOptions.reduce((n, o) => n + o.count, 0);
  const openFilters = () => filtersSheetRef.current?.present();

  const header = (
    <View className="bg-surface">
      <BrowseLocationControls
        location={location}
        criteria={criteria}
        totalInProvince={provinceCount}
        wards={wardOptions}
        view={view}
        plottableCount={mapWarehouses.filter(hasPlottableCoords).length}
        onView={setView}
        onChange={changeCriteria}
        onOpenFilters={openFilters}
      />
      {view === 'list' ? (
        <BrowseQuickFilters criteria={criteria} onChange={changeCriteria} />
      ) : null}
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
              pickedIds={selectedIds}
              searchCenter={nearbySearch?.center ?? null}
              selectedWarehouseId={mapWarehouse?.id ?? null}
              warehouses={mapWarehouses}
              onSelect={(warehouse) => setMapWarehouseId(warehouse.id)}
            />
            <BrowseMapOverlay
              activeFilterCount={activeFilterCount}
              nearbyCount={nearbySearch ? mapWarehouses.length : null}
              searchLabel={nearbySearch?.label ?? null}
              selectedCount={selected.length}
              onClearSearch={() => {
                setNearbySearch(null);
                setMapWarehouseId(null);
              }}
              onOpenFilters={openFilters}
              onSearch={() => placeSearchSheetRef.current?.present()}
            />
            {nearbySearch && mapWarehouses.length === 0 ? (
              <View className="absolute top-28 right-4 left-4 rounded-xl bg-surface p-3">
                <Text className="font-body text-body-sm text-foreground">
                  Không có kho trống phù hợp trong 5 km. Thử địa điểm khác hoặc xóa tìm kiếm.
                </Text>
              </View>
            ) : null}
            {!nearbySearch && hasMore ? (
              <Text className="absolute right-4 bottom-3 left-4 rounded-lg bg-surface/90 px-2 py-1 text-center font-body text-caption text-muted">
                Bản đồ hiển thị {warehouses.length}/{total} kho. Thu hẹp bộ lọc để xem đủ.
              </Text>
            ) : null}
            <WarehouseMapSheet
              hasHolding={hasHolding}
              selected={selected}
              sheetRef={warehouseSheetRef}
              warehouse={mapWarehouse}
              onContinue={continueFromMap}
              onDismiss={dismissWarehouse}
              onToggle={toggleWarehouse}
            />
          </View>
        </>
      ) : (
        <ScrollView
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
              hasFilters={activeFilterCount > 0}
              hasHolding={hasHolding}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              selectedIds={selectedIds}
              total={total}
              warehouses={warehouses}
              onLoadMore={loadMore}
              onToggle={toggleWarehouse}
            />
          ) : null}
        </ScrollView>
      )}

      {view === 'list' && selected.length > 0 && !isInitialLoading ? (
        <BrowseSelectionBar
          hasHolding={hasHolding}
          selected={selected}
          onContinue={() => onHold(selected)}
        />
      ) : null}

      <BrowseFiltersSheet
        criteria={criteria}
        provinceOptions={provinceOptions}
        resultCount={nearbySearch && view === 'map' ? mapWarehouses.length : total}
        sheetRef={filtersSheetRef}
        wardOptions={wardOptions}
        onChange={changeCriteria}
      />
      <MapPlaceSearchSheet sheetRef={placeSearchSheetRef} onChoose={choosePlace} />
    </View>
  );
}
