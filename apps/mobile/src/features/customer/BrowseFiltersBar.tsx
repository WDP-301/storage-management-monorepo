import { Button, Card } from 'heroui-native';
import { Text, View } from 'react-native';
import type { BrowseCriteria } from '../../types/customer';
import { countActiveFilters, describeActiveFilters, MAX_UNITS_PER_BOOKING } from './browse-filters';
import type { LocationOption } from './location-options';

type Props = {
  criteria: BrowseCriteria;
  onChange: (criteria: BrowseCriteria) => void;
  onOpenFilters: () => void;
  provinceOptions: readonly LocationOption[];
  wardOptions: readonly LocationOption[];
};

/**
 * Compact replacement for the old inline filter card.
 *
 * The unit-count stepper stays out here rather than moving into the sheet: it drives what every
 * facility card proposes and gets adjusted constantly while browsing, so hiding it behind a modal
 * would add a round trip to the most frequent action on the screen.
 */
export function BrowseFiltersBar({
  criteria,
  onChange,
  onOpenFilters,
  provinceOptions,
  wardOptions,
}: Props) {
  const activeCount = countActiveFilters(criteria);
  const summary = describeActiveFilters(criteria, provinceOptions, wardOptions);

  const changeQuantity = (next: number) =>
    onChange({
      ...criteria,
      requestedQuantity: Math.min(MAX_UNITS_PER_BOOKING, Math.max(1, next)),
    });

  return (
    <Card className="mx-4 border border-border bg-surface">
      <Card.Body className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-medium text-muted">Số kho cần thuê</Text>
            <Text className="mt-1 text-sm font-semibold text-foreground">
              Ưu tiên các kho cùng một cơ sở
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Button
              accessibilityLabel="Giảm số lượng kho"
              isDisabled={criteria.requestedQuantity === 1}
              isIconOnly
              size="sm"
              variant="secondary"
              onPress={() => changeQuantity(criteria.requestedQuantity - 1)}
            >
              <Button.Label>−</Button.Label>
            </Button>
            <Text className="min-w-6 text-center text-base font-bold text-foreground">
              {criteria.requestedQuantity}
            </Text>
            <Button
              accessibilityLabel="Tăng số lượng kho"
              isDisabled={criteria.requestedQuantity === MAX_UNITS_PER_BOOKING}
              isIconOnly
              size="sm"
              variant="secondary"
              onPress={() => changeQuantity(criteria.requestedQuantity + 1)}
            >
              <Button.Label>+</Button.Label>
            </Button>
          </View>
        </View>

        <View className="h-px bg-separator" />

        <Button
          accessibilityLabel="Mở bộ lọc"
          variant={activeCount > 0 ? 'primary' : 'secondary'}
          onPress={onOpenFilters}
        >
          <Button.Label>
            {activeCount > 0 ? `Bộ lọc · ${activeCount}` : 'Bộ lọc'} · {criteria.durationMonths}{' '}
            tháng
          </Button.Label>
        </Button>

        {summary.length > 0 ? (
          <Text className="text-xs leading-5 text-muted">{summary.join(' · ')}</Text>
        ) : null}
      </Card.Body>
    </Card>
  );
}
