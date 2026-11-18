import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from './button';
import { Text } from './text';

/** A transfer reference that must match exactly, with a one-tap copy. */
export function CopyableCode({ value }: { value: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-subtle py-2 pr-2 pl-3.5">
      <Text
        className="flex-1 text-body-lg font-semibold text-text-primary tabular-nums"
        numberOfLines={1}
      >
        {value}
      </Text>
      <Button
        fullWidth={false}
        label={isCopied ? 'Đã chép' : 'Chép'}
        leftIcon={isCopied ? 'check' : 'content-copy'}
        size="sm"
        variant="secondary"
        onPress={async () => {
          await Clipboard.setStringAsync(value);
          setIsCopied(true);
        }}
      />
    </View>
  );
}
