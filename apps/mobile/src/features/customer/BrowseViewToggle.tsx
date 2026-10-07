import { Button } from 'heroui-native';
import { View } from 'react-native';
import type { BrowseView } from '../../types/customer';

type Props = {
  view: BrowseView;
  onChange: (view: BrowseView) => void;
  /** Facilities that actually have coordinates; 0 disables the map tab rather than showing an empty one. */
  plottableCount: number;
};

/** List/map switch. Sits next to the filter bar so both views share one filter state. */
export function BrowseViewToggle({ view, onChange, plottableCount }: Props) {
  return (
    <View className="mt-3 flex-row gap-2 px-4">
      <Button
        className="flex-1"
        size="sm"
        variant={view === 'list' ? 'primary' : 'secondary'}
        onPress={() => onChange('list')}
      >
        <Button.Label>Danh sách</Button.Label>
      </Button>
      <Button
        className="flex-1"
        isDisabled={plottableCount === 0}
        size="sm"
        variant={view === 'map' ? 'primary' : 'secondary'}
        onPress={() => onChange('map')}
      >
        <Button.Label>Bản đồ{plottableCount > 0 ? ` (${plottableCount})` : ''}</Button.Label>
      </Button>
    </View>
  );
}
