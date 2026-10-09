import { Button, Input } from '@cloudflare/kumo';
import { Crosshair, MagnifyingGlass } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import { PlacesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { PlacePrediction } from '../../types/warehouse';

interface Props {
  addressLine: string;
  onAddressChange: (value: string) => void;
  onPlacePicked: (place: { address: string; lat: number; lng: number }) => void;
  /** Typed address plus ward/province, geocoded by "Lấy tọa độ từ địa chỉ". */
  locateQuery: string;
  /** Fills coordinates only; the typed address is kept as written. */
  onLocated: (point: { lat: number; lng: number }) => void;
}

/**
 * Address input with Goong autocomplete; picking a suggestion fills address and coordinates.
 * A typed address can also be geocoded directly, taking Goong's best match.
 */
export const WarehouseAddressPicker: React.FC<Props> = ({
  addressLine,
  onAddressChange,
  onPlacePicked,
  locateQuery,
  onLocated,
}) => {
  const toast = useAppToast();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  // The place the coordinates were taken from, shown so the match can be checked.
  const [locatedFrom, setLocatedFrom] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setPredictions([]);
      return;
    }
    let cancelled = false;
    const handler = setTimeout(() => {
      PlacesApi.autocomplete(term)
        .then((list) => !cancelled && setPredictions(list ?? []))
        .catch(() => !cancelled && setPredictions([]));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [query]);

  const pick = async (prediction: PlacePrediction) => {
    setIsSearching(true);
    try {
      const detail = await PlacesApi.detail(prediction.place_id);
      onPlacePicked({ address: detail.address, lat: detail.lat, lng: detail.lng });
      setLocatedFrom(null);
      setQuery('');
      setPredictions([]);
    } catch (err) {
      toast.error(
        'Không lấy được vị trí',
        err instanceof Error ? err.message : 'Vui lòng thử lại hoặc nhập tọa độ thủ công.',
      );
    } finally {
      setIsSearching(false);
    }
  };

  const locate = async () => {
    setIsLocating(true);
    try {
      const [best] = (await PlacesApi.autocomplete(locateQuery)) ?? [];
      if (!best) {
        setLocatedFrom(null);
        toast.warning(
          'Không tìm thấy vị trí',
          'Không tìm thấy địa chỉ này trên bản đồ. Hãy chọn một gợi ý ở ô tìm địa chỉ hoặc đặt ghim trên bản đồ.',
        );
        return;
      }
      const detail = await PlacesApi.detail(best.place_id);
      onLocated({ lat: detail.lat, lng: detail.lng });
      setLocatedFrom(best.description);
    } catch (err) {
      toast.error(
        'Không lấy được tọa độ',
        err instanceof Error ? err.message : 'Vui lòng thử lại hoặc đặt ghim trên bản đồ.',
      );
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          label="Tìm địa chỉ (gợi ý từ bản đồ)"
          placeholder="Nhập tên đường, tòa nhà..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {predictions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-lg bg-kumo-base ring ring-kumo-line shadow-lg">
            {predictions.map((p) => (
              <li key={p.place_id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-left text-xs"
                  icon={<MagnifyingGlass className="w-3.5 h-3.5" />}
                  disabled={isSearching}
                  onClick={() => pick(p)}
                >
                  {p.description}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Input
        label="Địa chỉ kho"
        placeholder="Số nhà, tên đường"
        value={addressLine}
        onChange={(e) => {
          setLocatedFrom(null);
          onAddressChange(e.target.value);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Crosshair className="w-3.5 h-3.5" />}
          disabled={addressLine.trim() === '' || isLocating}
          loading={isLocating}
          onClick={locate}
        >
          Lấy tọa độ từ địa chỉ
        </Button>
        {locatedFrom && (
          <p role="status" className="text-kumo-subtle">
            Đã lấy tọa độ theo "{locatedFrom}". Kiểm tra ghim trên bản đồ bên dưới.
          </p>
        )}
      </div>
    </div>
  );
};
