import { ListBullets, MapTrifold } from 'phosphor-react-native';
import { Pressable, View } from 'react-native';
import { colors, Text } from '../../components/ui';
import type { BrowseView } from '../../types/customer';

type Props = { view: BrowseView; onChange: (view: BrowseView) => void; plottableCount: number };

export function BrowseViewToggle({ view, onChange, plottableCount }: Props) {
  return (
    <View className="flex-row rounded-full bg-bg-subtle p-0.5">
      {(['list', 'map'] as const).map((value) => {
        const selected = view === value;
        const disabled = value === 'map' && plottableCount === 0;
        const Icon = value === 'list' ? ListBullets : MapTrifold;
        return (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(value)}
            style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
          >
            <View
              className={`min-h-9 flex-row items-center justify-center gap-1.5 rounded-full px-3 py-1.5 ${
                selected ? 'bg-bg-card shadow-sm' : ''
              }`}
            >
              <Icon
                color={selected ? colors.semantic.textLink : colors.semantic.textSecondary}
                size={15}
                weight={selected ? 'bold' : 'regular'}
              />
              <Text
                className={`text-caption font-semibold ${
                  selected ? 'text-text-link' : 'text-text-secondary'
                }`}
              >
                {value === 'list' ? 'Danh sách' : 'Bản đồ'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
