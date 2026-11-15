import { View } from 'react-native';
import type { RequestScope } from '../../../../lib/shelf-storage-format';
import { TabChip } from '../../../components/ui';

/** "Của tôi" (requests assigned to the viewer) or "Tất cả" (the whole warehouse), with counts. */
export function AssigneeFilter({
  scope,
  onChange,
  mineCount,
  allCount,
}: {
  scope: RequestScope;
  onChange: (scope: RequestScope) => void;
  mineCount: number;
  allCount: number;
}) {
  return (
    <View className="flex-row gap-2">
      <TabChip
        count={mineCount}
        label="Của tôi"
        onPress={() => onChange('MINE')}
        selected={scope === 'MINE'}
        tone="primary"
      />
      <TabChip
        count={allCount}
        label="Tất cả"
        onPress={() => onChange('ALL')}
        selected={scope === 'ALL'}
        tone="primary"
      />
    </View>
  );
}
