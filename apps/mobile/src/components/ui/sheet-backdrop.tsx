import { BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import colors from './colors';

/** Techvera "Coat" backdrop (`rgba(6, 9, 15, 0.7)`) for bottom sheets. */
export function renderCoatBackdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={1}
      style={[props.style, { backgroundColor: colors.semantic.coat }]}
    />
  );
}
