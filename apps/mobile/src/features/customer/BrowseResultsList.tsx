import { Button } from 'heroui-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import type { BrowseMode, FacilityOffer, UnitOffer } from '../../types/customer';
import { ManualFacilityCard, RecommendedFacilityCard } from './BrowseFacilityCards';
import { BrowseListHeader } from './BrowseListHeader';
import { EmptyState } from './BrowseStates';

type Props = {
  /** Already filtered by `applyBrowseFilters`; paging happens here and nowhere else. */
  facilities: readonly FacilityOffer[];
  /** Unfiltered total, so the empty state can tell "no data" from "filtered everything out". */
  totalFacilityCount: number;
  hasMore: boolean;
  mode: BrowseMode;
  onModeChange: (mode: BrowseMode) => void;
  page: number;
  onPageChange: (page: number) => void;
  hasHolding: boolean;
  requestedQuantity: number;
  selectedIds: readonly string[];
  onToggle: (unit: UnitOffer) => void;
  onHold: (units: UnitOffer[]) => void;
  waitlistedFacilityId: string | null;
  onWaitlist: (facilityId: string) => void;
};

/**
 * The list half of Browse: mode header, facility cards and pagination.
 *
 * Split out of `BrowseUnitsScreen` so that screen can stay under the file-size cap once the map
 * view joined it. The paging maths moved here unchanged — only the list mode ever needed it.
 */
export function BrowseResultsList({
  facilities,
  totalFacilityCount,
  hasMore,
  mode,
  onModeChange,
  page,
  onPageChange,
  hasHolding,
  requestedQuantity,
  selectedIds,
  onToggle,
  onHold,
  waitlistedFacilityId,
  onWaitlist,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const unitCount = facilities.reduce((total, facility) => total + facility.units.length, 0);
  const pageSize = mode === 'recommended' ? 5 : 10;
  const resultCount = mode === 'recommended' ? facilities.length : unitCount;
  const pageCount = Math.max(1, Math.ceil(resultCount / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;

  const pagedFacilities = useMemo(() => {
    if (mode === 'recommended') {
      return facilities.slice(pageStart, pageStart + pageSize);
    }
    // Page individual units, retaining their facility headers and the full selection elsewhere.
    let offset = 0;
    return facilities.flatMap((facility) => {
      const start = Math.max(0, pageStart - offset);
      const end = Math.min(facility.units.length, pageStart + pageSize - offset);
      offset += facility.units.length;
      return end > start ? [{ ...facility, units: facility.units.slice(start, end) }] : [];
    });
  }, [mode, pageStart, pageSize, facilities]);

  const goToPage = (next: number) => onPageChange(Math.max(1, Math.min(next, pageCount)));

  return (
    <>
      <BrowseListHeader
        requestedQuantity={requestedQuantity}
        facilityCount={facilities.length}
        hasMore={hasMore}
        mode={mode}
        onModeChange={onModeChange}
      />

      {facilities.length === 0 ? (
        <EmptyState isFilteredOut={totalFacilityCount > 0} />
      ) : (
        <View className="gap-4 px-4">
          {pagedFacilities.map((facility, index) => (
            // Staggered fade tells the customer the list actually changed after a filter edit.
            // Without it, swapping ward or price repaints in place and reads as "nothing happened".
            // Capped at six steps so a full page never feels like it is loading slowly.
            <Animated.View
              key={facility.id}
              entering={
                prefersReducedMotion
                  ? undefined
                  : FadeInDown.duration(220).delay(Math.min(index, 5) * 45)
              }
            >
              {mode === 'recommended' ? (
                <RecommendedFacilityCard
                  facility={facility}
                  hasHolding={hasHolding}
                  requestedQuantity={requestedQuantity}
                  waitlisted={waitlistedFacilityId === facility.id}
                  onHold={onHold}
                  onWaitlist={() => onWaitlist(facility.id)}
                />
              ) : (
                <ManualFacilityCard
                  facility={facility}
                  hasHolding={hasHolding}
                  requestedQuantity={requestedQuantity}
                  selectedIds={selectedIds}
                  onToggle={onToggle}
                />
              )}
            </Animated.View>
          ))}
        </View>
      )}

      {resultCount > 0 ? (
        <View className="gap-3 px-4 pt-5">
          <Text className="font-body text-center text-muted text-xs">
            Hiển thị {pageStart + 1}–{Math.min(pageStart + pageSize, resultCount)} / {resultCount}{' '}
            {mode === 'recommended' ? 'nhóm cơ sở' : 'kho'}
          </Text>
          {pageCount > 1 ? (
            <View className="flex-row items-center justify-between gap-3">
              <Button
                isDisabled={currentPage === 1}
                size="sm"
                variant="secondary"
                onPress={() => goToPage(currentPage - 1)}
              >
                <Button.Label className="font-ui">Trang trước</Button.Label>
              </Button>
              <Text className="font-strong text-foreground text-sm">
                {currentPage} / {pageCount}
              </Text>
              <Button
                isDisabled={currentPage === pageCount}
                size="sm"
                variant="secondary"
                onPress={() => goToPage(currentPage + 1)}
              >
                <Button.Label className="font-ui">Trang sau</Button.Label>
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
