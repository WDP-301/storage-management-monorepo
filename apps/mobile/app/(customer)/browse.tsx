import { useRouter } from 'expo-router';
import { useHold } from '../../lib/hold';
import { BrowseWarehousesScreen } from '../../src/features/customer/BrowseWarehousesScreen';

export default function BrowseRoute() {
  const router = useRouter();
  const { heldBooking, selectWarehouses } = useHold();

  return (
    <BrowseWarehousesScreen
      contentBottomPadding={32}
      hasHolding={Boolean(heldBooking)}
      onHold={(warehouses) => {
        selectWarehouses(warehouses);
        router.navigate('/(customer)/schedule');
      }}
    />
  );
}
