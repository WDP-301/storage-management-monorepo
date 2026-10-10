import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import type { PickedFile } from '../../../lib/uploads-api';

/** Smaller files upload faster on site over 4G; inspection photos do not need full quality. */
const PHOTO_QUALITY = 0.6;

/** Shoots or picks photos; resolves to `[]` when the user cancels or denies the permission. */
export async function pickImages(
  source: 'camera' | 'library',
  remaining: number,
): Promise<PickedFile[]> {
  // `selectionLimit: 0` means "no limit" to the picker, and a negative slice would drop the tail.
  if (remaining <= 0) return [];
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Chưa có quyền', 'Hãy cấp quyền camera/thư viện ảnh trong Cài đặt.');
    return [];
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
  if (result.canceled) return [];
  return result.assets.slice(0, remaining).map((asset, index) => ({
    uri: asset.uri,
    name: asset.fileName ?? `inspection-${Date.now()}-${index + 1}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
    size: asset.fileSize,
  }));
}

/** Picks PDF files; resolves to `[]` when the user cancels. */
export async function pickPdfs(remaining: number): Promise<PickedFile[]> {
  if (remaining <= 0) return [];
  // Loaded on demand: the module resolves its native half at import time and throws on a binary
  // built before it was added, which would otherwise take down every screen importing this file.
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, remaining).map((asset, index) => ({
    uri: asset.uri,
    name: asset.name || `contract-${Date.now()}-${index + 1}.pdf`,
    mimeType: 'application/pdf',
    size: asset.size,
  }));
}
