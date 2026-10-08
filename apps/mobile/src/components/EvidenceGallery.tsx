import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { UploadsApi } from '../../lib/uploads-api';
import type { EvidenceFile } from '../types/contract-api';

type Props = {
  files: readonly EvidenceFile[];
};

/**
 * Photo grid for inspection evidence. The bucket is private, so each thumb resolves its own
 * presigned URL; tapping opens it full screen with a fresh URL (presigned links expire).
 */
export function EvidenceGallery({ files }: Props) {
  const [viewing, setViewing] = useState<EvidenceFile | null>(null);
  if (files.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-2">
      {files.map((file) => (
        <EvidenceThumb key={file.fileKey} file={file} onPress={() => setViewing(file)} />
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

function EvidenceThumb({ file, onPress }: { file: EvidenceFile; onPress: () => void }) {
  const isImage = file.mimeType.startsWith('image/');
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
          <Text className="text-center text-[10px] text-muted" numberOfLines={3}>
            {file.name}
          </Text>
        </View>
      )}
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
          <Text className="text-sm text-white">Không mở được tệp này.</Text>
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
        <Text className="mt-4 text-sm text-white">{file?.name}</Text>
        <Text className="mt-1 text-xs text-white/70">Chạm để đóng</Text>
      </Pressable>
    </Modal>
  );
}
