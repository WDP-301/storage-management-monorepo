import { ScrollView, View } from 'react-native';

import { TabChip } from './tab-chip';

export type CardTabItem<K extends string> = {
  key: K;
  label: string;
  count?: number;
};

type Props<K extends string> = {
  tabs: readonly CardTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  tone?: 'primary' | 'secondary' | 'surface';
  className?: string;
  testID?: string;
};

/** Horizontal scrollable row of pill tabs for list and inbox screens. */
export function CardTabs<K extends string>({
  tabs,
  value,
  onChange,
  tone = 'surface',
  className = '',
  testID,
}: Props<K>) {
  return (
    <View className={className} testID={testID}>
      <ScrollView
        className="-mx-4"
        contentContainerClassName="flex-row gap-2 px-4"
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {tabs.map((tab) => (
          <TabChip
            key={tab.key}
            count={tab.count}
            label={tab.label}
            onPress={() => onChange(tab.key)}
            selected={tab.key === value}
            testID={testID ? `${testID}-${tab.key}` : undefined}
            tone={tone}
          />
        ))}
      </ScrollView>
    </View>
  );
}
