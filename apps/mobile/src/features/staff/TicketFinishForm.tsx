import { Button, Label, TextArea, TextField } from 'heroui-native';
import { Image, Pressable, Text, View } from 'react-native';
import type { PickedFile } from '../../../lib/uploads-api';

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
    <View className="gap-3 rounded-xl border border-border bg-surface p-3">
      <Text className="font-strong text-body-lg text-foreground">{copy.title}</Text>
      <TextField isRequired>
        <Label className="font-ui">{copy.label}</Label>
        <TextArea
          placeholder={copy.placeholder}
          value={note}
          onChangeText={onChangeNote}
          maxLength={5000}
          editable={!isSaving}
        />
      </TextField>

      <View className="gap-2">
        <Label className="font-ui">
          Ảnh sau xử lý ({photos.length}/{MAX_FINISH_PHOTOS})
        </Label>
        {photos.length > 0 ? (
          <View className="flex-row flex-wrap gap-3">
            {photos.map((photo) => (
              <Pressable
                key={photo.uri}
                accessibilityLabel="Bỏ ảnh"
                disabled={isSaving}
                onPress={() => onRemovePhoto(photo.uri)}
              >
                <Image source={{ uri: photo.uri }} className="size-20 rounded-lg" />
                <Text className="font-body mt-1 text-center text-caption text-muted">Bỏ</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View className="flex-row gap-2">
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!canAddPhotos}
            onPress={() => onAddPhotos('camera')}
          >
            <Button.Label className="font-ui">Chụp ảnh</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!canAddPhotos}
            onPress={() => onAddPhotos('library')}
          >
            <Button.Label className="font-ui">Chọn từ thư viện</Button.Label>
          </Button>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Button className="flex-1" variant="tertiary" isDisabled={isSaving} onPress={onCancel}>
          <Button.Label className="font-ui">Để sau</Button.Label>
        </Button>
        <Button
          className="flex-1"
          variant={mode === 'close' ? 'danger' : 'primary'}
          isDisabled={isSaving || note.trim().length === 0}
          onPress={onSubmit}
        >
          <Button.Label className="font-ui">{isSaving ? 'Đang lưu...' : copy.cta}</Button.Label>
        </Button>
      </View>
    </View>
  );
}
