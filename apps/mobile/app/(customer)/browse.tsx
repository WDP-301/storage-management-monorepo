import { useRouter } from 'expo-router';
import { useHold } from '../../lib/hold';
import { BrowseUnitsScreen } from '../../src/features/customer/BrowseUnitsScreen';

export default function BrowseRoute() {
  const router = useRouter();
  const { heldBooking, selectUnits } = useHold();

  return (
    <BrowseUnitsScreen
      contentBottomPadding={32}
      hasHolding={Boolean(heldBooking)}
      onHold={(units) => {
        selectUnits(units);
        router.navigate('/(customer)/schedule');
      }}
    />
  );
}
