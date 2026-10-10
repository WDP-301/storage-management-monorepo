import { Button, Input } from '@cloudflare/kumo';
import { Crosshair, MagnifyingGlass } from '@phosphor-icons/react';
import React, { useEffect, useId, useState } from 'react';
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
 * Address input with Goong suggestions while typing; picking one fills address and coordinates.
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
  const listId = useId();
  // Only typing searches, so a prefilled or just-picked address does not reopen suggestions.
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPicking, setIsPicking] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  // The place the coordinates were taken from, shown so the match can be checked.
  const [locatedFrom, setLocatedFrom] = useState<string | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    const handler = setTimeout(() => {
      PlacesApi.autocomplete(term)
        .then((list) => list ?? [])
        .catch(() => [])
        .then((list) => {
          if (cancelled) return;
          setPredictions(list);
          setActiveIndex(-1);
          setOpen(list.length > 0);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handler);
    };
  }, [query]);

  const pick = async (prediction: PlacePrediction) => {
    if (isPicking) return;
    setIsPicking(true);
    try {
      const detail = await PlacesApi.detail(prediction.place_id);
      onPlacePicked({ address: detail.address, lat: detail.lat, lng: detail.lng });
      setLocatedFrom(null);
      setQuery('');
      setOpen(false);
    } catch (err) {
      toast.error(
        'Không lấy được vị trí',
        err instanceof Error ? err.message : 'Vui lòng thử lại hoặc nhập tọa độ thủ công.',
      );
    } finally {
      setIsPicking(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || predictions.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => (i + step + predictions.length) % predictions.length);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      // Enter picks the highlighted suggestion instead of submitting the form.
      event.preventDefault();
      void pick(predictions[activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
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
          'Không tìm thấy địa chỉ này trên bản đồ. Hãy chọn một gợi ý khi nhập địa chỉ hoặc đặt ghim trên bản đồ.',
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
          label="Địa chỉ kho"
          placeholder="Nhập số nhà, tên đường để xem gợi ý"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          value={addressLine}
          onChange={(e) => {
            setLocatedFrom(null);
            setQuery(e.target.value);
            onAddressChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(predictions.length > 0)}
          onBlur={() => setOpen(false)}
        />
        {open && (
          <div
            id={listId}
            role="listbox"
            aria-label="Gợi ý địa chỉ"
            className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-lg bg-kumo-base py-1 ring ring-kumo-line shadow-lg"
          >
            {predictions.map((p, index) => (
              <div
                key={p.place_id}
                id={`${listId}-${index}`}
                role="option"
                // Focus stays in the input (aria-activedescendant); -1 keeps options out of tab order.
                tabIndex={-1}
                aria-selected={index === activeIndex}
                aria-disabled={isPicking}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-kumo-default ${
                  index === activeIndex ? 'bg-kumo-tint' : 'hover:bg-kumo-tint'
                }`}
                // Keep focus in the input so its blur does not close the list before the click.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void pick(p);
                  }
                }}
              >
                <MagnifyingGlass className="w-3.5 h-3.5 shrink-0 text-kumo-subtle" />
                {p.description}
              </div>
            ))}
          </div>
        )}
      </div>
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
