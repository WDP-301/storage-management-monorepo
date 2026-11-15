import { StatusBar } from 'expo-status-bar';
import type * as React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBar } from './app-bar';
import type { IconName } from './icon';

const WEB_STATUS_BAR = 12;

type Props = {
  title: string;
  titleAlign?: 'center' | 'left';
  children: React.ReactNode;
  transparent?: boolean;
  /** Neutral `#EEF1F3` page canvas beneath white `bg-bg-card` cards, with a white AppBar. */
  muted?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  backLabel?: string;
  action?: { icon: IconName; label: string; onPress: () => void };
  headerRight?: React.ReactNode;
  /** Default false because route layouts provide top safe-area inset (`edges={['top']}`). */
  withTopInset?: boolean;
  includeBottomInset?: boolean;
  testID?: string;
};

/** Screen shell with white AppBar and optional muted card background. */
export function FlowScreen({
  title,
  titleAlign = 'center',
  children,
  transparent = false,
  muted = false,
  showBack = true,
  onBack,
  backLabel,
  action,
  headerRight,
  withTopInset = false,
  includeBottomInset = false,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const top = withTopInset ? (Platform.OS === 'web' ? WEB_STATUS_BAR : insets.top) : 0;
  const pageClass = transparent ? '' : muted ? 'bg-bg-muted' : 'bg-bg-page';
  const barClass = transparent ? 'bg-transparent border-transparent' : '';

  return (
    <View
      className={`flex-1 ${pageClass}`}
      style={{
        paddingTop: muted || transparent ? 0 : top,
        paddingBottom: includeBottomInset ? insets.bottom : 0,
      }}
      testID={testID}
    >
      <StatusBar style="dark" />
      {muted && !transparent && top > 0 ? (
        <View className="bg-bg-page" style={{ height: top }} />
      ) : null}
      {transparent && top > 0 ? <View style={{ height: top }} /> : null}
      <View>
        <AppBar
          actionIcon={action?.icon}
          actionLabel={action?.label}
          backLabel={backLabel}
          className={barClass}
          onAction={action?.onPress}
          onBack={onBack}
          showBack={showBack}
          testID="flow-app-bar"
          title={title}
          titleAlign={titleAlign}
        />
        {headerRight ? (
          <View className="absolute top-0 right-4 h-14 justify-center">{headerRight}</View>
        ) : null}
      </View>
      {children}
    </View>
  );
}
