import { Button, Input } from '@cloudflare/kumo';
import { MagnifyingGlass } from '@phosphor-icons/react';
import React, { useEffect, useState } from 'react';
import { PlacesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { PlacePrediction } from '../../types/warehouse';

interface Props {
  addressLine: string;
  onAddressChange: (value: string) => void;
  onPlacePicked: (place: { address: string; lat: number; lng: number }) => void;
}

/** Address input with Goong autocomplete; picking a suggestion fills address and coordinates. */
export const WarehouseAddressPicker: React.FC<Props> = ({
  addressLine,
  onAddressChange,
  onPlacePicked,
}) => {
  const toast = useAppToast();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
        onChange={(e) => onAddressChange(e.target.value)}
      />
    </div>
  );
};
