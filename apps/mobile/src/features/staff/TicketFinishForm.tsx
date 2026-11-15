import { Image, Pressable, View } from 'react-native';
import type { PickedFile } from '../../../lib/uploads-api';
import { Button, FieldLabel, Input, Text } from '../../components/ui';

export const MAX_FINISH_PHOTOS = 5;

export type FinishMode = 'resolve' | 'close';

const COPY: Record<FinishMode, { title: string; label: string; placeholder: string; cta: string }> =
  {
    resolve: {
      title: 'Hoàn tất xử lý',
      label: 'Kết quả xử lý',
      placeholder: 'Ví dụ: Đã thay khóa mới, khách kiểm tra hoạt động bình thường.',
      cta: 'Xác nhận hoàn tất',
    },
    close: {
      title: 'Đóng yêu cầu',
      label: 'Lý do đóng',
      placeholder: 'Ví dụ: Đã giải quyết trực tiếp với khách, không cần xử lý thêm.',
      cta: 'Xác nhận đóng',
    },
  };

type Props = {
  mode: FinishMode;
  note: string;
  photos: PickedFile[];
  isSaving: boolean;
  onChangeNote: (note: string) => void;
  onAddPhotos: (source: 'camera' | 'library') => void;
  onRemovePhoto: (uri: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

/** Note (required) and optional after-work photos sent with RESOLVED or CLOSED. */
export function TicketFinishForm({
  mode,
  note,
  photos,
  isSaving,
  onChangeNote,
  onAddPhotos,
  onRemovePhoto,
  onSubmit,
  onCancel,
}: Props) {
  const copy = COPY[mode];
  const canAddPhotos = photos.length < MAX_FINISH_PHOTOS && !isSaving;

  return (
    <View className="gap-4 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-subtitle font-semibold text-text-primary">{copy.title}</Text>
      <Input
        disabled={isSaving}
        editable={!isSaving}
        label={copy.label}
        maxLength={5000}
        multiline
        onChangeText={onChangeNote}
        placeholder={copy.placeholder}
        required
        value={note}
      />

      <View className="gap-2">
        <FieldLabel>{`Ảnh sau xử lý (${photos.length}/${MAX_FINISH_PHOTOS})`}</FieldLabel>
        {photos.length > 0 ? (
          <View className="flex-row flex-wrap gap-3">
            {photos.map((photo) => (
              <Pressable
                key={photo.uri}
                accessibilityLabel="Bỏ ảnh"
                disabled={isSaving}
                onPress={() => onRemovePhoto(photo.uri)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Image className="size-20 rounded-xl" source={{ uri: photo.uri }} />
                <Text className="mt-1 text-center text-caption font-medium text-status-danger">
                  Bỏ
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View className="flex-row gap-2.5">
          <Button
            className="flex-1"
            disabled={!canAddPhotos}
            label="Chụp ảnh"
            leftIcon="photo-camera"
            onPress={() => onAddPhotos('camera')}
            size="sm"
            variant="secondary"
          />
          <Button
            className="flex-1"
            disabled={!canAddPhotos}
            label="Chọn từ thư viện"
            leftIcon="photo-library"
            onPress={() => onAddPhotos('library')}
            size="sm"
            variant="secondary"
          />
        </View>
      </View>

      <View className="flex-row gap-2.5">
        <Button
          className="flex-1"
          disabled={isSaving}
          label="Để sau"
          onPress={onCancel}
          variant="secondary"
        />
        <Button
          className="flex-1"
          disabled={isSaving || note.trim().length === 0}
          label={isSaving ? 'Đang lưu...' : copy.cta}
          loading={isSaving}
          onPress={onSubmit}
          variant={mode === 'close' ? 'destructive' : 'primary'}
        />
      </View>
    </View>
  );
}
