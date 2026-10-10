import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
import { UploadsApi } from '../../lib/uploads-api';
import type { EvidenceFile } from '../types/contract-api';

type Props = {
  files: readonly EvidenceFile[];
  /** Edit mode: shows a remove badge on each thumb. */
  onRemove?: (file: EvidenceFile) => void;
};

const isImageFile = (file: EvidenceFile) => file.mimeType.startsWith('image/');

/** Non-image files (PDF) open in the system viewer; a presign failure tells the user to retry. */
async function openExternally(file: EvidenceFile) {
  try {
    const res = await UploadsApi.downloadUrl(file.fileKey);
    await Linking.openURL(res.downloadUrl);
  } catch {
    Alert.alert('Không mở được tệp', 'Kiểm tra kết nối rồi thử lại.');
  }
}

/**
 * Evidence grid for inspections and contract files. The bucket is private, so each thumb resolves
 * its own presigned URL; tapping an image opens it full screen with a fresh URL (presigned links
 * expire), any other file opens in the system viewer.
 */
export function EvidenceGallery({ files, onRemove }: Props) {
  const [viewing, setViewing] = useState<EvidenceFile | null>(null);
  // File being handed to the system viewer: repeated taps are ignored until it opens.
  const [opening, setOpening] = useState<string | null>(null);
  if (files.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-2">
      {files.map((file) => (
        <View key={file.fileKey}>
          <EvidenceThumb
            file={file}
            isOpening={opening === file.fileKey}
            onPress={() => {
              if (isImageFile(file)) return setViewing(file);
              if (opening) return;
              setOpening(file.fileKey);
              void openExternally(file).finally(() => setOpening(null));
            }}
          />
          {onRemove ? (
            <Pressable
              accessibilityLabel={`Xoá ${file.name}`}
              className="absolute -right-1.5 -top-1.5 size-6 items-center justify-center rounded-full bg-danger"
              hitSlop={6}
              onPress={() => onRemove(file)}
            >
              <Text className="text-caption font-strong text-white">✕</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <EvidenceViewer file={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

function usePresignedUrl(file: EvidenceFile | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const fileKey = file?.fileKey ?? null;

  useEffect(() => {
    setUrl(null);
    if (!fileKey) return;
    const controller = new AbortController();
    UploadsApi.downloadUrl(fileKey, controller.signal)
      .then((res) => setUrl(res.downloadUrl))
      .catch(() => undefined);
    return () => controller.abort();
  }, [fileKey]);

  return url;
}

function EvidenceThumb({
  file,
  isOpening,
  onPress,
}: {
  file: EvidenceFile;
  isOpening: boolean;
  onPress: () => void;
}) {
  const isImage = isImageFile(file);
  const url = usePresignedUrl(isImage ? file : null);
  // A presigned URL is issued even for a missing object; fall back to the name if it 404s.
  const [failed, setFailed] = useState(false);

  return (
    <Pressable onPress={onPress} accessibilityLabel={file.name}>
      {isImage && url && !failed ? (
        <Image
          source={{ uri: url }}
          className="size-20 rounded-lg"
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View className="size-20 items-center justify-center rounded-lg border border-border bg-background p-1">
          {file.mimeType === 'application/pdf' ? (
            <Text className="font-strong text-body-sm text-foreground">PDF</Text>
          ) : null}
          <Text className="font-body text-center text-caption text-muted" numberOfLines={2}>
            {file.name}
          </Text>
        </View>
      )}
      {isOpening ? (
        <View className="absolute inset-0 items-center justify-center rounded-lg bg-black/40">
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

function EvidenceViewer({ file, onClose }: { file: EvidenceFile | null; onClose: () => void }) {
  const url = usePresignedUrl(file);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [file]);

  return (
    <Modal visible={file !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/90" onPress={onClose}>
        {failed ? (
          <Text className="font-body text-body-sm text-white">Không mở được tệp này.</Text>
        ) : url ? (
          <Image
            source={{ uri: url }}
            className="h-4/5 w-full"
            resizeMode="contain"
            onError={() => setFailed(true)}
          />
        ) : (
          <ActivityIndicator color="#fff" />
        )}
        <Text className="font-body mt-4 text-body-sm text-white">{file?.name}</Text>
        <Text className="font-body mt-1 text-caption text-white/70">Chạm để đóng</Text>
      </Pressable>
    </Modal>
  );
}
