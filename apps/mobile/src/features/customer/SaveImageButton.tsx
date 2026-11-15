import { useState } from 'react';
import { View } from 'react-native';
import type { SaveImageOutcome } from '../../../lib/save-image-to-library';
import { Button, InlineMessage } from '../../components/ui';

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

  return (
    <View className="w-full items-center gap-2">
      <Button
        disabled={isSaving}
        fullWidth
        label={isSaving ? 'Đang lưu...' : outcome ? SAVE_IMAGE_LABELS[outcome] : label}
        leftIcon="download"
        loading={isSaving}
        size={isCompact ? 'sm' : 'default'}
        variant="secondary"
        onPress={async () => {
          setIsSaving(true);
          // A retry must start from a clean slate rather than leave the previous result on screen
          // while the new attempt runs.
          setOutcome(null);
          setOutcome(await onSave());
          setIsSaving(false);
        }}
      />
      {outcome === 'denied' ? (
        <InlineMessage
          message="Cấp quyền ảnh cho ứng dụng trong Cài đặt để lưu được ảnh."
          type="warning"
        />
      ) : null}
    </View>
  );
}
