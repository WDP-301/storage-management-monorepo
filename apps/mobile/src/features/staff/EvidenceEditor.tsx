import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../../lib/api';
import { type PickedFile, UploadsApi } from '../../../lib/uploads-api';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import {
  Button,
  colors,
  InlineMessage,
  renderCoatBackdrop,
  SheetHandle,
  Text,
} from '../../components/ui';
import type { EvidenceFile } from '../../types/contract-api';
import { pickImages } from './pick-files';

type Props = {
  files: EvidenceFile[];
  /** Called with the photos that finished uploading; the parent merges them into its latest state. */
  onAdd: (added: EvidenceFile[]) => void;
  onRemove: (file: EvidenceFile) => void;
  /** Lets the screen block Save/Finalize and the leave guard while a photo is on its way. */
  onUploadingChange: (uploading: boolean) => void;
  max: number;
  readOnly?: boolean;
};

/**
 * Inspection photos: shoot or pick, upload right away (the record stores file keys), remove.
 * Uploads run one by one so a weak connection fails on a single photo, not the whole batch.
 */
export function EvidenceEditor({
  files,
  onAdd,
  onRemove,
  onUploadingChange,
  max,
  readOnly,
}: Props) {
  const [progress, setProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const sourceSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  if (readOnly) return <EvidenceGallery files={files} />;

  const upload = async (picked: PickedFile[]) => {
    if (picked.length === 0) return;
    const added: EvidenceFile[] = [];
    setUploadError(null);
    onUploadingChange(true);
    try {
      for (const [index, file] of picked.entries()) {
        setProgress(`Đang tải ảnh ${index + 1}/${picked.length}…`);
        added.push(await UploadsApi.uploadFile(file));
      }
    } catch (error) {
      setUploadError(
        error instanceof ApiError ? error.message : 'Tải ảnh thất bại. Vui lòng thử lại.',
      );
    } finally {
      setProgress(null);
      if (added.length > 0) onAdd(added);
      onUploadingChange(false);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    sourceSheetRef.current?.dismiss();
    await upload(await pickImages(source, max - files.length));
  };

  return (
    <View className="gap-3">
      <EvidenceGallery files={files} onRemove={onRemove} />
      {uploadError ? <InlineMessage message={uploadError} type="error" /> : null}
      {progress ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color={colors.semantic.actionPrimary} size="small" />
          <Text className="text-body text-text-secondary">{progress}</Text>
        </View>
      ) : (
        <Button
          disabled={files.length >= max}
          label={files.length >= max ? `Tối đa ${max} ảnh` : `Thêm ảnh (${files.length}/${max})`}
          leftIcon={files.length >= max ? undefined : 'add-a-photo'}
          onPress={() => sourceSheetRef.current?.present()}
          size="sm"
          variant="secondary"
        />
      )}

      <BottomSheetModal
        ref={sourceSheetRef}
        backdropComponent={renderCoatBackdrop}
        backgroundStyle={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        }}
        enableDynamicSizing
        handleComponent={SheetHandle}
      >
        <BottomSheetView>
          <View className="gap-3 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
            <Text className="text-subtitle font-semibold text-text-primary">Thêm ảnh</Text>
            <Text className="text-body text-text-secondary">
              Chụp ảnh mới hoặc chọn ảnh có sẵn trong máy.
            </Text>
            <Button
              fullWidth
              label="Chụp ảnh"
              leftIcon="photo-camera"
              onPress={() => void pick('camera')}
            />
            <Button
              fullWidth
              label="Chọn từ thư viện"
              leftIcon="photo-library"
              onPress={() => void pick('library')}
              variant="secondary"
            />
            <Button
              fullWidth
              label="Huỷ"
              onPress={() => sourceSheetRef.current?.dismiss()}
              variant="text"
            />
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
