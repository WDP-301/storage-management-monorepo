import type * as React from 'react';
import { Modal, View } from 'react-native';

type Props = {
  visible: boolean;
  onRequestClose?: () => void;
  children: React.ReactNode;
  testID?: string;
};

/** Centered modal dialog on dark backdrop matching Medipay Dialog. */
export function Dialog({ visible, onRequestClose, children, testID }: Props) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose ?? (() => {})}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View className="flex-1 items-center justify-center bg-black/75 px-4" testID={testID}>
        <View className="w-full items-center gap-4 rounded-3xl bg-bg-card px-5 py-6">
          {children}
        </View>
      </View>
    </Modal>
  );
}
