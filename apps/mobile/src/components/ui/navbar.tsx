import type * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from './colors';
import { Icon, type IconName } from './icon';
import { Text } from './text';

export type NavbarTab = {
  key: string;
  label: string;
  icon?: IconName;
  renderIcon?: (color: string, active: boolean) => React.ReactNode;
  testID?: string;
  badge?: number;
};

type Props = {
  tabs: readonly NavbarTab[];
  activeKey: string;
  onTabPress: (key: string) => void;
};

const CONTENT_HEIGHT = 56;
const MIN_BOTTOM_SPACE = 16;

/** Bottom tab navigation bar styled after Medipay Navbar (`#007BB5` active, `#667783` idle). */
export function Navbar({ tabs, activeKey, onTabPress }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row border-t border-border-default bg-surface"
      style={{ height: CONTENT_HEIGHT + Math.max(insets.bottom, MIN_BOTTOM_SPACE) }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        const iconColor = active ? colors.semantic.textLink : colors.semantic.textSecondary;
        const badgeCount = tab.badge ?? 0;

        return (
          <Pressable
            key={tab.key}
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center gap-1 pt-3"
            onPress={() => onTabPress(tab.key)}
            testID={tab.testID}
          >
            <View>
              {tab.renderIcon ? (
                tab.renderIcon(iconColor, active)
              ) : tab.icon ? (
                <Icon color={iconColor} name={tab.icon} size={22} />
              ) : null}
              {badgeCount > 0 ? (
                <View
                  className="absolute -top-1 -right-2.5 h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1"
                  testID={tab.testID ? `${tab.testID}-badge` : undefined}
                >
                  <Text className="text-[10px] leading-[12px] font-bold text-white">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              className={`text-caption font-medium ${active ? 'text-text-link' : 'text-text-secondary'}`}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
