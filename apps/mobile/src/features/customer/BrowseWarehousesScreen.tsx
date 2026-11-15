import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useBrowseSelection } from '../../../lib/browse-selection';
import { useBookingSettings } from '../../../lib/client-settings';
import { hasPlottableCoords } from '../../../lib/goong-map-config';
import { type PlacePrediction, WIDE_NEARBY_RADIUS_KM } from '../../../lib/places-api';
import { isShelfWarehouse } from '../../../lib/shelf-rental';
import { countActiveFilters, matchesNearbyCriteria } from '../../../lib/warehouse-query';
import { Button, Text } from '../../components/ui';
import type { BrowseView } from '../../types/customer';
import type { NearbyWarehouse, Warehouse } from '../../types/storage-api';
import { BrowseFiltersSheet } from './BrowseFiltersSheet';
import { BrowseBrandHeader, BrowseLocationControls, nearbyTitle } from './BrowseHeader';
import { BrowseMapOverlay } from './BrowseMapOverlay';
import { BrowseMapView } from './BrowseMapView';
import { BrowseResultsList } from './BrowseResultsList';
import { BrowseSelectionBar } from './BrowseSelectionBar';
import { ErrorState, LoadingState } from './BrowseStates';
import { LocationPickerSheet } from './LocationPickerSheet';
import { NearbySearchBanner } from './NearbySearchBanner';
import { useBrowseCriteria } from './use-browse-criteria';
import { useNearbySearch } from './use-nearby-search';
import { useWarehouses } from './use-warehouses';
import { WarehouseDetailScreen } from './WarehouseDetailScreen';
import { WarehouseMapSheet } from './WarehouseMapSheet';

type Props = {
  hasHolding: boolean;
  contentBottomPadding: number;
  onHold: (warehouses: Warehouse[]) => void;
};

export function BrowseWarehousesScreen({ hasHolding, contentBottomPadding, onHold }: Props) {
  const router = useRouter();
  const { selected, toggle: toggleWarehouse, clear: clearSelection } = useBrowseSelection();
  const { maxUnitsPerBooking } = useBookingSettings();
  const { criteria, setCriteria, provinceOptions, wardOptions, amenityOptions, reloadAmenities } =
    useBrowseCriteria();
  const { warehouses, total, hasMore, isLoading, isLoadingMore, error, loadMore, refetch } =
    useWarehouses(criteria);
  const [view, setView] = useState<BrowseView>('list');
  const [mapWarehouseId, setMapWarehouseId] = useState<string | null>(null);
  const [detailWarehouse, setDetailWarehouse] = useState<Warehouse | NearbyWarehouse | null>(null);
  const nearby = useNearbySearch();
  const nearbySearch = nearby.search;
  const filtersSheetRef = useRef<BottomSheetModal>(null);
  const warehouseSheetRef = useRef<BottomSheetModal>(null);
  const locationSheetRef = useRef<BottomSheetModal>(null);
  const pendingContinueRef = useRef(false);
  const pendingShelfIdRef = useRef<string | null>(null);

  // A nearby search replaces the paged results in both views; it has no server filters, so the
  // size/price criteria are applied here.
  const nearbyWarehouses = nearbySearch
    ? nearbySearch.warehouses.filter((warehouse) => matchesNearbyCriteria(warehouse, criteria))
    : null;
  const mapWarehouses: readonly Warehouse[] = nearbyWarehouses ?? warehouses;
  const mapWarehouse = mapWarehouses.find((warehouse) => warehouse.id === mapWarehouseId) ?? null;
  const selectedIds = selected.map((warehouse) => warehouse.id);

  const activeFilterCount = countActiveFilters(criteria);

  // A refresh keeps the current list on screen; only a first load blanks it out.
  const hasData = warehouses.length > 0;
  const isInitialLoading = isLoading && !hasData;
  const isRefreshing = isLoading && hasData;

  const openWarehouse = (warehouse: Warehouse | NearbyWarehouse) => {
    if (isShelfWarehouse(warehouse)) {
      router.push({ pathname: '/(customer)/shelves', params: { id: warehouse.id } });
      return;
    }
    setDetailWarehouse(warehouse);
  };
  const openWarehouseFromMap = (warehouse: Warehouse) => {
    if (!isShelfWarehouse(warehouse)) {
      setDetailWarehouse(warehouse);
      return;
    }
    pendingShelfIdRef.current = warehouse.id;
    warehouseSheetRef.current?.dismiss();
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
    if (pendingShelfIdRef.current) {
      const id = pendingShelfIdRef.current;
      pendingShelfIdRef.current = null;
      router.push({ pathname: '/(customer)/shelves', params: { id } });
      return;
    }
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
  const openFilters = () => {
    reloadAmenities();
    filtersSheetRef.current?.present();
  };
  const refresh = () => {
    reloadAmenities();
    if (nearbySearch) nearby.refresh();
    else refetch();
  };

  const header = (
    <View className="border-b border-border-default bg-bg-page">
      <BrowseLocationControls
        activeFilterCount={activeFilterCount}
        criteria={criteria}
        isLocating={nearby.isBusy && !nearbySearch}
        location={location}
        nearby={nearbySearch}
        plottableCount={mapWarehouses.filter(hasPlottableCoords).length}
        view={view}
        wards={wardOptions}
        onClearNearby={clearNearby}
        onOpenFilters={openFilters}
        onOpenLocation={openLocation}
        onView={setView}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-bg-muted">
      <BrowseBrandHeader />
      {view === 'map' ? (
        // Outside the ScrollView on purpose: a ScrollView swallows the map's pan and zoom gestures.
        <>
          {header}
          {isInitialLoading ? <LoadingState /> : null}
          {error ? <ErrorState message={error} onRetry={refetch} /> : null}
          <View className="flex-1">
            <BrowseMapView
              pickedIds={selectedIds}
              searchCenter={nearbySearch?.center ?? null}
              searchRadiusKm={nearbySearch?.radiusKm ?? null}
              searchSource={nearbySearch?.source ?? null}
              selectedWarehouseId={mapWarehouse?.id ?? null}
              warehouses={mapWarehouses}
              onSelect={(warehouse) => setMapWarehouseId(warehouse.id)}
            />
            <BrowseMapOverlay
              error={nearby.error}
              isLocating={nearby.isBusy}
              nearbyCount={nearbyWarehouses?.length ?? null}
              radiusKm={nearbySearch?.radiusKm ?? null}
              searchLabel={nearbySearch?.label ?? null}
              selectedCount={selected.length}
              onClearSearch={clearNearby}
              onNearMe={searchNearMe}
              onSearch={openLocation}
            />
            {nearbySearch && nearbyWarehouses?.length === 0 ? (
              <View className="absolute right-4 bottom-4 left-4 gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
                <Text className="text-body-sm text-text-primary">
                  Không có kho trống phù hợp trong {nearbySearch.radiusKm} km.
                </Text>
                {nearby.canWiden ? (
                  <Button
                    disabled={nearby.isBusy}
                    fullWidth={false}
                    label={`Mở rộng ${WIDE_NEARBY_RADIUS_KM} km`}
                    size="sm"
                    onPress={nearby.widenRadius}
                  />
                ) : null}
              </View>
            ) : null}
            {!nearbySearch && hasMore && selected.length === 0 ? (
              <View className="absolute right-4 bottom-3 left-4 rounded-xl border border-border-default bg-bg-card/95 px-3 py-1.5">
                <Text className="text-center text-caption text-text-secondary tabular-nums">
                  Bản đồ hiển thị {warehouses.length}/{total} kho. Thu hẹp bộ lọc để xem đủ.
                </Text>
              </View>
            ) : null}
            <WarehouseMapSheet
              hasHolding={hasHolding}
              selected={selected}
              sheetRef={warehouseSheetRef}
              warehouse={mapWarehouse}
              onContinue={continueFromMap}
              onDismiss={dismissWarehouse}
              onOpenDetail={openWarehouseFromMap}
              onToggle={toggleWarehouse}
            />
          </View>
        </>
      ) : (
        <ScrollView
          className="flex-1 bg-bg-muted"
          contentContainerStyle={{ paddingBottom: contentBottomPadding }}
          refreshControl={
            <RefreshControl refreshing={nearbySearch ? false : isRefreshing} onRefresh={refresh} />
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
                onOpen={openWarehouse}
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
                  onOpen={openWarehouse}
                  onToggle={toggleWarehouse}
                />
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      {selected.length > 0 && (nearbySearch || !isInitialLoading) ? (
        <BrowseSelectionBar
          hasHolding={hasHolding}
          selected={selected}
          onContinue={() => onHold(selected)}
          onClear={clearSelection}
        />
      ) : null}

      <BrowseFiltersSheet
        amenityOptions={amenityOptions}
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
      <WarehouseDetailScreen
        distanceKm={
          detailWarehouse && 'distanceKm' in detailWarehouse
            ? detailWarehouse.distanceKm
            : undefined
        }
        hasHolding={hasHolding}
        isDisabled={
          hasHolding ||
          (!selectedIds.includes(detailWarehouse?.id ?? '') &&
            selected.length >= maxUnitsPerBooking)
        }
        isSelected={selectedIds.includes(detailWarehouse?.id ?? '')}
        warehouse={detailWarehouse}
        onClose={() => setDetailWarehouse(null)}
        onToggle={toggleWarehouse}
      />
    </View>
  );
}
