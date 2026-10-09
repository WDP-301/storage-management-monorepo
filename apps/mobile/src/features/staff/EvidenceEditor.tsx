import * as ImagePicker from 'expo-image-picker';
import { Button } from 'heroui-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { type PickedFile, UploadsApi } from '../../../lib/uploads-api';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import type { EvidenceFile } from '../../types/contract-api';

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

/** Smaller files upload faster on site over 4G; inspection photos do not need full quality. */
const PHOTO_QUALITY = 0.6;

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
  if (readOnly) return <EvidenceGallery files={files} />;

  const upload = async (picked: PickedFile[]) => {
    const added: EvidenceFile[] = [];
    onUploadingChange(true);
    try {
      for (const [index, file] of picked.entries()) {
        setProgress(`Đang tải ảnh ${index + 1}/${picked.length}…`);
        added.push(await UploadsApi.uploadImage(file));
      }
    } catch (error) {
      Alert.alert('Tải ảnh thất bại', error instanceof ApiError ? error.message : 'Thử lại sau.');
    } finally {
      setProgress(null);
      if (added.length > 0) onAdd(added);
      onUploadingChange(false);
    }
  };

  const pick = async (source: 'camera' | 'library') => {
    const remaining = max - files.length;
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Chưa có quyền', 'Hãy cấp quyền camera/thư viện ảnh trong Cài đặt.');
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: PHOTO_QUALITY })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: PHOTO_QUALITY,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
          });
    if (result.canceled) return;
    await upload(
      result.assets.slice(0, remaining).map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName ?? `inspection-${Date.now()}-${index + 1}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize,
      })),
    );
  };

  const choose = () =>
    Alert.alert('Thêm ảnh', 'Chụp ảnh mới hoặc chọn ảnh có sẵn trong máy.', [
      { text: 'Chụp ảnh', onPress: () => void pick('camera') },
      { text: 'Chọn từ thư viện', onPress: () => void pick('library') },
      { text: 'Huỷ', style: 'cancel' },
    ]);

  return (
    <View className="gap-3">
      <EvidenceGallery files={files} onRemove={onRemove} />
      {progress ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-muted">{progress}</Text>
        </View>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          isDisabled={files.length >= max}
          onPress={choose}
        >
          <Button.Label>
            {files.length >= max ? `Tối đa ${max} ảnh` : `+ Thêm ảnh (${files.length}/${max})`}
          </Button.Label>
        </Button>
      )}
    </View>
  );
}
