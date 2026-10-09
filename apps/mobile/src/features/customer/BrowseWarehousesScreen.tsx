import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Button } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { hasPlottableCoords } from '../../../lib/goong-map-config';
import { type PlacePrediction, WIDE_NEARBY_RADIUS_KM } from '../../../lib/places-api';
import {
  countActiveFilters,
  MAX_WAREHOUSES_PER_BOOKING,
  matchesNearbyCriteria,
} from '../../../lib/warehouse-query';
import type { BrowseView } from '../../types/customer';
import type { Warehouse } from '../../types/storage-api';
import { BrowseFiltersSheet } from './BrowseFiltersSheet';
import { BrowseBrandHeader, BrowseLocationControls, nearbyTitle } from './BrowseHeader';
import { BrowseMapOverlay } from './BrowseMapOverlay';
import { BrowseMapView } from './BrowseMapView';
import { BrowseQuickFilters } from './BrowseQuickFilters';
import { BrowseResultsList } from './BrowseResultsList';
import { BrowseSelectionBar } from './BrowseSelectionBar';
import { ErrorState, LoadingState } from './BrowseStates';
import { LocationPickerSheet } from './LocationPickerSheet';
import { NearbySearchBanner } from './NearbySearchBanner';
import { useBrowseCriteria } from './use-browse-criteria';
import { useNearbySearch } from './use-nearby-search';
import { useWarehouses } from './use-warehouses';
import { WarehouseMapSheet } from './WarehouseMapSheet';

type Props = {
  hasHolding: boolean;
  contentBottomPadding: number;
  onHold: (warehouses: Warehouse[]) => void;
  /** Changes whenever the customer's set of active holds changes. */
  holdsKey: string;
};

export function BrowseWarehousesScreen({
  hasHolding,
  holdsKey,
  contentBottomPadding,
  onHold,
}: Props) {
  const { criteria, setCriteria, provinceOptions, wardOptions } = useBrowseCriteria();
  const { warehouses, total, hasMore, isLoading, isLoadingMore, error, loadMore, refetch } =
    useWarehouses(criteria);
  const [view, setView] = useState<BrowseView>('list');
  const [selected, setSelected] = useState<Warehouse[]>([]);
  const [mapWarehouseId, setMapWarehouseId] = useState<string | null>(null);
  const nearby = useNearbySearch();
  const nearbySearch = nearby.search;
  const filtersSheetRef = useRef<BottomSheetModal>(null);
  const warehouseSheetRef = useRef<BottomSheetModal>(null);
  const locationSheetRef = useRef<BottomSheetModal>(null);
  const pendingContinueRef = useRef(false);

  // A nearby search replaces the paged results in both views; it has no server filters, so the
  // size/price criteria are applied here.
  const nearbyWarehouses = nearbySearch
    ? nearbySearch.warehouses.filter((warehouse) => matchesNearbyCriteria(warehouse, criteria))
    : null;
  const mapWarehouses: readonly Warehouse[] = nearbyWarehouses ?? warehouses;
  const mapWarehouse = mapWarehouses.find((warehouse) => warehouse.id === mapWarehouseId) ?? null;
  const selectedIds = selected.map((warehouse) => warehouse.id);

  // A new hold means the picks were just booked; keeping them would resubmit held warehouses.
  useEffect(() => {
    setSelected([]);
  }, [holdsKey]);
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
    // Picking a province or ward means "look there" — it replaces any nearby search.
    if (next.provinceCode !== criteria.provinceCode || next.wardCode !== criteria.wardCode) {
      nearby.clear();
    }
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
    await nearby.searchPlace(place);
    setMapWarehouseId(null);
    warehouseSheetRef.current?.dismiss();
  };
  const searchNearMe = () => {
    setMapWarehouseId(null);
    warehouseSheetRef.current?.dismiss();
    void nearby.searchNearMe();
  };
  const clearNearby = () => {
    nearby.clear();
    setMapWarehouseId(null);
  };
  const openLocation = () => locationSheetRef.current?.present();

  const selectedProvince = provinceOptions.find((option) => option.code === criteria.provinceCode);
  const location = nearbySearch
    ? nearbyTitle(nearbySearch)
    : (selectedProvince?.name ??
      (provinceOptions.length === 1 ? provinceOptions[0].name : 'Tất cả kho'));
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
        nearby={nearbySearch}
        isLocating={nearby.isBusy && !nearbySearch}
        onOpenLocation={openLocation}
        onClearNearby={clearNearby}
      />
      {view === 'list' ? (
        <BrowseQuickFilters criteria={criteria} onChange={changeCriteria} />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1">
      <BrowseBrandHeader
        location={location}
        scope={nearbySearch ? `Trong ${nearbySearch.radiusKm} km` : undefined}
        onLocation={openLocation}
      />
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
              searchSource={nearbySearch?.source ?? null}
              searchRadiusKm={nearbySearch?.radiusKm ?? null}
              selectedWarehouseId={mapWarehouse?.id ?? null}
              warehouses={mapWarehouses}
              onSelect={(warehouse) => setMapWarehouseId(warehouse.id)}
            />
            <BrowseMapOverlay
              activeFilterCount={activeFilterCount}
              error={nearby.error}
              isLocating={nearby.isBusy}
              nearbyCount={nearbyWarehouses?.length ?? null}
              radiusKm={nearbySearch?.radiusKm ?? null}
              searchLabel={nearbySearch?.label ?? null}
              selectedCount={selected.length}
              onClearSearch={clearNearby}
              onNearMe={searchNearMe}
              onOpenFilters={openFilters}
              onSearch={openLocation}
            />
            {nearbySearch && nearbyWarehouses?.length === 0 ? (
              <View className="absolute right-4 bottom-4 left-4 gap-2 rounded-xl bg-surface p-3 shadow-sm">
                <Text className="font-body text-body-sm text-foreground">
                  Không có kho trống phù hợp trong {nearbySearch.radiusKm} km.
                </Text>
                {nearby.canWiden ? (
                  <Button isDisabled={nearby.isBusy} size="sm" onPress={nearby.widenRadius}>
                    <Button.Label className="font-ui">
                      Mở rộng {WIDE_NEARBY_RADIUS_KM} km
                    </Button.Label>
                  </Button>
                ) : null}
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
          refreshControl={
            <RefreshControl
              refreshing={nearbySearch ? false : isRefreshing}
              onRefresh={nearbySearch ? nearby.refresh : refetch}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {header}
          <NearbySearchBanner
            canWiden={nearby.canWiden}
            error={nearby.error}
            isBusy={nearby.isBusy}
            resultCount={nearbyWarehouses?.length ?? 0}
            search={nearbySearch}
            onWiden={nearby.widenRadius}
          />
          {nearbyWarehouses ? (
            nearbyWarehouses.length > 0 ? (
              <BrowseResultsList
                hasFilters={activeFilterCount > 0}
                hasHolding={hasHolding}
                hasMore={false}
                isLoadingMore={false}
                selectedIds={selectedIds}
                summary={`${nearbyWarehouses.length} kho trống gần ${
                  nearbySearch?.source === 'me' ? 'bạn' : nearbySearch?.label
                }, gần nhất trước`}
                total={nearbyWarehouses.length}
                warehouses={nearbyWarehouses}
                onLoadMore={loadMore}
                onToggle={toggleWarehouse}
              />
            ) : null
          ) : (
            <>
              {isInitialLoading ? <LoadingState /> : null}
              {/* A failed refresh keeps the stale list below, so the error sits above it rather
                than replacing everything the customer was already looking at. */}
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
            </>
          )}
        </ScrollView>
      )}

      {view === 'list' && selected.length > 0 && (nearbySearch || !isInitialLoading) ? (
        <BrowseSelectionBar
          hasHolding={hasHolding}
          selected={selected}
          onContinue={() => onHold(selected)}
          onClear={() => setSelected([])}
        />
      ) : null}

      <BrowseFiltersSheet
        criteria={criteria}
        provinceOptions={provinceOptions}
        resultCount={nearbyWarehouses?.length ?? total}
        sheetRef={filtersSheetRef}
        wardOptions={wardOptions}
        onChange={changeCriteria}
      />
      <LocationPickerSheet
        isNearbyActive={nearbySearch !== null}
        provinceOptions={provinceOptions}
        selectedProvinceCode={criteria.provinceCode}
        sheetRef={locationSheetRef}
        onChoosePlace={choosePlace}
        onChooseProvince={(code) =>
          changeCriteria({ ...criteria, provinceCode: code, wardCode: null })
        }
        onNearMe={searchNearMe}
      />
    </View>
  );
}
