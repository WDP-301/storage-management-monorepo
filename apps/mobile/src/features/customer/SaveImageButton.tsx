import { Button, useThemeColor } from 'heroui-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { SaveImageOutcome } from '../../../lib/save-image-to-library';
import { DownloadIcon } from '../../components/ActionIcons';

const SAVE_IMAGE_LABELS: Record<SaveImageOutcome, string> = {
  saved: 'Đã lưu vào thư viện ảnh',
  denied: 'Chưa được cấp quyền lưu ảnh',
  failed: 'Lưu không được, thử lại',
};

/**
 * The button text is the only feedback a save gets, so the outcome replaces the label rather than
 * appearing somewhere else on the screen.
 */
export function SaveImageButton({
  label,
  isCompact = false,
  onSave,
}: {
  label: string;
  isCompact?: boolean;
  onSave: () => Promise<SaveImageOutcome>;
}) {
  const [outcome, setOutcome] = useState<SaveImageOutcome | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [mutedColor] = useThemeColor(['muted']);

  return (
    <View className="items-center gap-2">
      <Button
        className={isCompact ? undefined : 'w-full'}
        size={isCompact ? 'sm' : 'md'}
        variant="secondary"
        isDisabled={isSaving}
        onPress={async () => {
          setIsSaving(true);
          // A retry must start from a clean slate rather than leave the previous result on screen
          // while the new attempt runs.
          setOutcome(null);
          setOutcome(await onSave());
          setIsSaving(false);
        }}
      >
        <DownloadIcon color={mutedColor} />
        <Button.Label className="font-ui">
          {isSaving ? 'Đang lưu...' : outcome ? SAVE_IMAGE_LABELS[outcome] : label}
        </Button.Label>
      </Button>
      {outcome === 'denied' ? (
        <Text className="font-body text-center text-caption leading-5 text-muted">
          Cấp quyền ảnh cho ứng dụng trong Cài đặt để lưu được ảnh.
        </Text>
      ) : null}
    </View>
  );
}
