import { useHold } from '../../lib/hold';
import { BrowseUnitsScreen } from '../../src/features/customer/BrowseUnitsScreen';

export default function BrowseRoute() {
  const { heldBooking, holdUnits } = useHold();

  return (
    <BrowseUnitsScreen contentBottomPadding={32} heldBooking={heldBooking} onHold={holdUnits} />
  );
}
