// `Map` is aliased because MapLibre v11 renamed `MapView` to `Map`, which shadows the JS global
// and trips biome's lint/suspicious/noShadowRestrictedNames. Alias it in every file that imports it.
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapLibreMap,
  Marker,
} from '@maplibre/maplibre-react-native';
import { MapPin as PinIcon } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  circlePolygon,
  DEFAULT_ZOOM,
  FIT_PADDING,
  goongStyleUrl,
  HCM_CENTER,
  hasMapTilesKey,
  hasPlottableCoords,
  MAX_ZOOM,
  toLngLat,
  toLngLatBounds,
} from '../../../lib/goong-map-config';
import { WarehousePin } from '../../components/WarehousePin';
import type { Warehouse } from '../../types/storage-api';

type Props = {
  /** Already filtered — the map never filters on its own. */
  warehouses: readonly Warehouse[];
  selectedWarehouseId: string | null;
  pickedIds: readonly string[];
  onSelect: (warehouse: Warehouse) => void;
  searchCenter: { lat: number; lng: number } | null;
  /** `me` draws the customer's position as a location dot instead of a place pin. */
  searchSource: 'place' | 'me' | null;
  searchRadiusKm: number | null;
};

/**
 * `fitBounds` takes pixel insets, not a single number. The top inset also clears the floating
 * search bar and chips (`BrowseMapOverlay`), which would otherwise cover the northernmost pins.
 */
const FIT_INSETS = {
  top: FIT_PADDING + 96,
  right: FIT_PADDING,
  bottom: FIT_PADDING,
  left: FIT_PADDING,
};
const ACCENT = '#006398';

export function BrowseMapView({
  warehouses,
  selectedWarehouseId,
  pickedIds,
  onSelect,
  searchCenter,
  searchSource,
  searchRadiusKm,
}: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const [mapHeight, setMapHeight] = useState(0);
  // `fitBounds` is ignored while the style is still loading, which would strand the camera on the
  // HCM default. `onDidFinishLoadingMap` exists in v11 (checked against Map.d.ts), so gate on it
  // rather than guessing with a timeout.
  const [isMapReady, setIsMapReady] = useState(false);

  const plottable = useMemo(() => warehouses.filter(hasPlottableCoords), [warehouses]);
  // Render the selected pin last so a nearby warehouse does not cover its exact price.
  const orderedPins = useMemo(
    () =>
      [...plottable].sort(
        (a, b) => Number(a.id === selectedWarehouseId) - Number(b.id === selectedWarehouseId),
      ),
    [plottable, selectedWarehouseId],
  );
  // A nearby search frames its center together with the results, so the customer sees both where
  // they searched and every warehouse found; with no results it frames the whole search circle.
  const bounds = useMemo(() => {
    if (!searchCenter) return toLngLatBounds(plottable);
    const center = { latitude: searchCenter.lat, longitude: searchCenter.lng };
    if (plottable.length > 0) return toLngLatBounds([center, ...plottable]);
    const ring = searchRadiusKm ? circlePolygon(searchCenter, searchRadiusKm).geometry : null;
    return toLngLatBounds(
      ring
        ? ring.coordinates[0].map(([longitude, latitude]) => ({ latitude, longitude }))
        : [center],
    );
  }, [plottable, searchCenter, searchRadiusKm]);
  const radiusArea = useMemo(
    () => (searchCenter && searchRadiusKm ? circlePolygon(searchCenter, searchRadiusKm) : null),
    [searchCenter, searchRadiusKm],
  );
  // Comparing the box rather than the array keeps the camera still when filtering changed nothing
  // geographically — refitting on every render fights the user's own panning.
  const boundsKey = bounds?.join(',') ?? '';

  useEffect(() => {
    if (!isMapReady || !boundsKey || !mapHeight) return;
    const box = boundsKey.split(',').map(Number) as [number, number, number, number];
    cameraRef.current?.fitBounds(box, {
      padding: FIT_INSETS,
      duration: 400,
    });
  }, [boundsKey, isMapReady, mapHeight]);

  if (!hasMapTilesKey) return <MapUnavailable />;

  const missingCount = warehouses.length - plottable.length;

  return (
    <View
      className="flex-1 overflow-hidden"
      onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}
    >
      <MapLibreMap
        attribution
        // The map is never rotated on purpose; the compass only appeared after an accidental
        // two-finger twist, right under the floating search bar.
        compass={false}
        mapStyle={goongStyleUrl}
        style={{ flex: 1 }}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: HCM_CENTER, zoom: DEFAULT_ZOOM }}
          maxZoom={MAX_ZOOM}
        />
        {radiusArea ? (
          <GeoJSONSource id="nearby-radius" data={radiusArea}>
            <Layer
              id="nearby-radius-fill"
              type="fill"
              paint={{ 'fill-color': ACCENT, 'fill-opacity': 0.07 }}
            />
            <Layer
              id="nearby-radius-line"
              type="line"
              paint={{ 'line-color': ACCENT, 'line-opacity': 0.5, 'line-width': 1.5 }}
            />
          </GeoJSONSource>
        ) : null}
        {orderedPins.map((warehouse) => (
          <Marker
            key={warehouse.id}
            // The pin's tip is at the bottom of its viewBox; the default "center" anchor would
            // float every pin half its height north of the warehouse it marks.
            anchor="bottom"
            id={warehouse.id}
            lngLat={toLngLat(warehouse)}
            style={{
              zIndex: warehouse.id === selectedWarehouseId ? 1 : 0,
              elevation: warehouse.id === selectedWarehouseId ? 1 : 0,
            }}
            onPress={() => onSelect(warehouse)}
          >
            <WarehousePin
              isPicked={pickedIds.includes(warehouse.id)}
              isSelected={selectedWarehouseId === warehouse.id}
              monthlyPrice={warehouse.monthlyPrice}
            />
          </Marker>
        ))}
        {searchCenter ? (
          <Marker
            id="searched-place"
            anchor={searchSource === 'me' ? 'center' : 'bottom'}
            lngLat={[searchCenter.lng, searchCenter.lat]}
          >
            {searchSource === 'me' ? (
              <View className="size-7 items-center justify-center rounded-full bg-accent/20">
                <View className="size-4 rounded-full border-2 border-surface bg-accent" />
              </View>
            ) : (
              <View className="size-9 items-center justify-center rounded-full border-2 border-surface bg-accent">
                <PinIcon color="white" size={20} weight="fill" />
              </View>
            )}
          </Marker>
        ) : null}
      </MapLibreMap>
      {/* Confirmed in validation: say how many pins are missing AND where to find them, so the
          map's warehouse count never silently disagrees with the list's. */}
      {missingCount > 0 ? (
        <Text className="font-body absolute top-2 left-3 right-3 rounded-lg bg-surface/90 px-2 py-1 text-caption text-muted">
          {missingCount} kho chưa có toạ độ, xem ở danh sách
        </Text>
      ) : null}
    </View>
  );
}

/** Shown instead of a blank grey map when the build has no Goong map-tiles key. */
function MapUnavailable() {
  return (
    <View className="m-4 flex-1 items-center justify-center rounded-2xl border border-border border-dashed px-6">
      <Text className="font-strong text-foreground">Chưa cấu hình bản đồ</Text>
      <Text className="font-body mt-1 text-center text-muted text-body-sm leading-5">
        Thiếu khoá bản đồ Goong. Hãy dùng chế độ danh sách, hoặc liên hệ quản trị viên để bổ sung
        cấu hình.
      </Text>
    </View>
  );
}
