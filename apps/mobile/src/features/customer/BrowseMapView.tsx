// `Map` is aliased because MapLibre v11 renamed `MapView` to `Map`, which shadows the JS global
// and trips biome's lint/suspicious/noShadowRestrictedNames. Alias it in every file that imports it.
import {
  Camera,
  type CameraRef,
  Map as MapLibreMap,
  Marker,
} from '@maplibre/maplibre-react-native';
import { MapPin as PinIcon } from 'phosphor-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
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
import { FacilityPin } from '../../components/FacilityPin';
import type { FacilityOffer } from '../../types/customer';

type Props = {
  /** Already filtered by `applyBrowseFilters` — the map never filters on its own. */
  facilities: readonly FacilityOffer[];
  selectedFacilityId: string | null;
  onSelect: (facility: FacilityOffer) => void;
  searchCenter: { lat: number; lng: number } | null;
};

/** `fitBounds` takes pixel insets, not a single number, so the shared padding is spread to all sides. */
const FIT_INSETS = {
  top: FIT_PADDING,
  right: FIT_PADDING,
  bottom: FIT_PADDING,
  left: FIT_PADDING,
};

export function BrowseMapView({ facilities, selectedFacilityId, onSelect, searchCenter }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const [mapHeight, setMapHeight] = useState(0);
  // `fitBounds` is ignored while the style is still loading, which would strand the camera on the
  // HCM default. `onDidFinishLoadingMap` exists in v11 (checked against Map.d.ts), so gate on it
  // rather than guessing with a timeout.
  const [isMapReady, setIsMapReady] = useState(false);

  const plottable = useMemo(() => facilities.filter(hasPlottableCoords), [facilities]);
  // Render the selected pin last so a nearby facility does not cover its exact price.
  const orderedPins = useMemo(
    () =>
      [...plottable].sort(
        (a, b) => Number(a.id === selectedFacilityId) - Number(b.id === selectedFacilityId),
      ),
    [plottable, selectedFacilityId],
  );
  const bounds = useMemo(() => toLngLatBounds(plottable), [plottable]);
  // Comparing the box rather than the array keeps the camera still when filtering changed nothing
  // geographically — refitting on every render fights the user's own panning.
  const boundsKey = bounds?.join(',') ?? '';

  useEffect(() => {
    if (!isMapReady || !boundsKey || !mapHeight || searchCenter) return;
    const box = boundsKey.split(',').map(Number) as [number, number, number, number];
    cameraRef.current?.fitBounds(box, {
      padding: FIT_INSETS,
      duration: 400,
    });
  }, [boundsKey, isMapReady, mapHeight, searchCenter]);

  useEffect(() => {
    if (!isMapReady || !searchCenter) return;
    cameraRef.current?.flyTo({
      center: [searchCenter.lng, searchCenter.lat],
      zoom: 12,
      duration: 450,
    });
  }, [isMapReady, searchCenter?.lat, searchCenter?.lng]);

  if (!hasMapTilesKey) return <MapUnavailable />;

  const missingCount = facilities.length - plottable.length;

  return (
    <View
      className="flex-1 overflow-hidden"
      onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}
    >
      <MapLibreMap
        attribution
        mapStyle={goongStyleUrl}
        style={{ flex: 1 }}
        onDidFinishLoadingMap={() => setIsMapReady(true)}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: HCM_CENTER, zoom: DEFAULT_ZOOM }}
          maxZoom={MAX_ZOOM}
        />
        {orderedPins.map((facility) => (
          <Marker
            key={facility.id}
            // The pin's tip is at the bottom of its viewBox; the default "center" anchor would
            // float every pin half its height north of the facility it marks.
            anchor="bottom"
            id={facility.id}
            lngLat={toLngLat(facility)}
            style={{
              zIndex: facility.id === selectedFacilityId ? 1 : 0,
              elevation: facility.id === selectedFacilityId ? 1 : 0,
            }}
            onPress={() => onSelect(facility)}
          >
            <FacilityPin
              count={facility.units.length}
              // Units arrive cheapest-first from the mapper, so the head of the list is the
              // "from" price without sorting again here.
              fromPrice={facility.units[0]?.monthlyPrice ?? 0}
              isSelected={selectedFacilityId === facility.id}
            />
          </Marker>
        ))}
        {searchCenter ? (
          <Marker id="searched-place" anchor="bottom" lngLat={[searchCenter.lng, searchCenter.lat]}>
            <View className="size-9 items-center justify-center rounded-full border-2 border-surface bg-accent">
              <PinIcon color="white" size={20} weight="fill" />
            </View>
          </Marker>
        ) : null}
      </MapLibreMap>
      {/* Confirmed in validation: say how many pins are missing AND where to find them, so the
          map's facility count never silently disagrees with the list's. */}
      {missingCount > 0 ? (
        <Text className="font-body absolute top-2 left-3 right-3 rounded-lg bg-surface/90 px-2 py-1 text-[11px] text-muted">
          {missingCount} cơ sở chưa có toạ độ, xem ở danh sách
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
      <Text className="font-body mt-1 text-center text-muted text-sm leading-5">
        Thiếu khoá bản đồ Goong. Hãy dùng chế độ danh sách, hoặc liên hệ quản trị viên để bổ sung
        cấu hình.
      </Text>
    </View>
  );
}
