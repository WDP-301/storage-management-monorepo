import { ListBullets, MapTrifold } from 'phosphor-react-native';
import { Pressable, Text, View } from 'react-native';
import type { BrowseView } from '../../types/customer';

type Props = { view: BrowseView; onChange: (view: BrowseView) => void; plottableCount: number };

export function BrowseViewToggle({ view, onChange, plottableCount }: Props) {
  return (
    <View className="flex-row rounded-full bg-surface-secondary p-0.5">
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
              className={`min-h-9 flex-row items-center justify-center gap-1 rounded-full px-2.5 py-1.5 ${selected ? 'bg-surface' : ''}`}
            >
              <Icon size={14} color={selected ? '#0f172a' : '#64748b'} />
              <Text
                className={`font-ui text-caption ${selected ? 'text-foreground' : 'text-muted'}`}
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
