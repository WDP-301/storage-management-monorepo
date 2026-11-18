import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { saveRemoteImage } from '../../../lib/save-image-to-library';
import { Button, StatusPill, Text } from '../../components/ui';
import { BankAppsSheet } from './bank-apps-sheet';
import { SaveImageButton } from './SaveImageButton';

/** VietQR's "compact2" template is taller than it is wide; locking the ratio stops it stretching. */
const QR_WIDTH = 220;
const QR_ASPECT_RATIO = 0.84;

/**
 * The payment VietQR, framed and sized the same on every screen. On the payer's own phone
 * (`saveName` given) it also offers saving the image and opening a banking app; a staff screen
 * held up for the customer to scan leaves both out.
 */
export function PaymentQr({
  url,
  label,
  saveName,
}: {
  url: string;
  /** Accessibility label for the QR image. */
  label: string;
  /** File name the saved image takes. */
  saveName?: string;
}) {
  const bankSheetRef = useRef<BottomSheetModal>(null);

  return (
    <View className="w-full items-center gap-3">
      <View className="items-center justify-center rounded-2xl bg-secondary-0 p-4">
        <Image
          accessibilityLabel={label}
          resizeMode="contain"
          source={{ uri: url }}
          style={{ width: QR_WIDTH, aspectRatio: QR_ASPECT_RATIO }}
        />
      </View>
      {saveName ? (
        <>
          <View className="w-full flex-row gap-2.5">
            <View className="flex-1">
              <SaveImageButton
                isCompact
                label="Lưu ảnh QR"
                onSave={() => saveRemoteImage(url, saveName)}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Mở app ngân hàng"
                leftIcon="account-balance"
                size="sm"
                variant="secondary"
                onPress={() => bankSheetRef.current?.present()}
              />
            </View>
          </View>
          <BankAppsSheet sheetRef={bankSheetRef} />
        </>
      ) : null}
    </View>
  );
}

/** The transfer note the webhook matches the payment on, so it must be sent unchanged. */
export function TransferContent({ value }: { value: string }) {
  return (
    <View className="w-full gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-body-sm text-text-secondary">Nội dung chuyển khoản</Text>
        <StatusPill label="Giữ nguyên nội dung" tone="warning" />
      </View>
      <CopyableCode value={value} />
    </View>
  );
}

function CopyableCode({ value }: { value: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border-default bg-bg-subtle py-2 pr-2 pl-3.5">
      <Text
        selectable
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
