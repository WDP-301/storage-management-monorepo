import { Button } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ContractDocumentsApi } from '../../../lib/contract-documents-api';
import {
  MAX_CONTRACT_FILE_BYTES,
  MAX_CONTRACT_FILES,
  splitBySize,
} from '../../../lib/contract-files';
import { type PickedFile, UploadsApi } from '../../../lib/uploads-api';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import type { EvidenceFile } from '../../types/contract-api';
import { pickImages, pickPdfs } from './pick-files';

type Props = {
  contractId: string;
  files: EvidenceFile[];
  /** Receives the list the server stored after every successful change. */
  onSaved: (files: EvidenceFile[]) => void;
  /** True from the first upload until the list is stored; feeds the leave guard. */
  onUploadingChange: (busy: boolean) => void;
  /** The contract changed under us (rights or status); the screen reloads to show why. */
  onStale: () => void;
};

/** API errors arrive in English except the files-required one; staff get Vietnamese. */
const errorText = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'Thử lại sau.';
  if (error.code === 'CONTRACT_DOCUMENTS_REQUIRED') return error.message;
  if (error.statusCode === 403) return 'Bạn không còn quyền sửa file hợp đồng này.';
  if (error.statusCode === 409) return 'Hợp đồng đã đổi trạng thái — màn hình đã tải lại.';
  if (error.statusCode === 400)
    return 'Tệp không hợp lệ — chỉ nhận ảnh JPG, PNG, WEBP, HEIC hoặc PDF, tối đa 10 tệp.';
  return error.message || 'Thử lại sau.';
};

const isStale = (error: unknown) =>
  error instanceof ApiError && (error.statusCode === 403 || error.statusCode === 409);

/**
 * Signed contract files. The contract is signed on paper, so shooting each page is the main
 * action. The server replaces the whole list on every PUT, so add/remove never overlap: every
 * action is locked until the previous one has been stored, and a failure keeps the old list.
 */
export function ContractDocumentsEditor({
  contractId,
  files,
  onSaved,
  onUploadingChange,
  onStale,
}: Props) {
  const [status, setStatus] = useState<string | null>(null);
  // The last list the server is known to hold. The parent's `files` only catch up once its
  // reload lands (or never, if that reload fails), so building the next PUT from the prop
  // could silently drop files that were just stored.
  const [stored, setStored] = useState(files);
  const storedRef = useRef(files);
  // A ref, not state: two taps in the same frame must not both start a change.
  const lockRef = useRef(false);
  useEffect(() => {
    storedRef.current = files;
    setStored(files);
  }, [files]);
  const busy = status !== null;
  const remaining = MAX_CONTRACT_FILES - stored.length;

  const run = async (task: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    onUploadingChange(true);
    try {
      await task();
    } finally {
      lockRef.current = false;
      setStatus(null);
      onUploadingChange(false);
    }
  };

  const store = async (next: EvidenceFile[]) => {
    setStatus('Đang lưu…');
    const saved = await ContractDocumentsApi.replace(contractId, next);
    storedRef.current = saved;
    setStored(saved);
    onSaved(saved);
  };

  const add = (pick: (slots: number) => Promise<PickedFile[]>) =>
    run(async () => {
      let picked: PickedFile[];
      try {
        picked = await pick(MAX_CONTRACT_FILES - storedRef.current.length);
      } catch {
        Alert.alert('Không mở được trình chọn', 'Cập nhật ứng dụng rồi thử lại.');
        return;
      }
      const { accepted, tooLarge } = splitBySize(picked);
      if (tooLarge.length > 0) {
        Alert.alert(
          'Tệp quá lớn',
          `Mỗi tệp tối đa ${MAX_CONTRACT_FILE_BYTES / 1024 / 1024}MB: ${tooLarge
            .map((f) => f.name)
            .join(', ')}`,
        );
      }
      if (accepted.length === 0) return;

      const added: EvidenceFile[] = [];
      let failure: unknown = null;
      for (const [index, file] of accepted.entries()) {
        setStatus(`Đang tải ${index + 1}/${accepted.length}…`);
        try {
          added.push(await UploadsApi.uploadFile(file));
        } catch (error) {
          failure = error;
          break;
        }
      }
      try {
        if (added.length > 0) await store([...storedRef.current, ...added]);
        if (failure) Alert.alert('Tải tệp thất bại', errorText(failure));
      } catch (error) {
        Alert.alert('Không lưu được hợp đồng', errorText(error));
        if (isStale(error)) onStale();
      }
    });

  const remove = (file: EvidenceFile) =>
    Alert.alert('Xoá tệp?', `Xoá "${file.name}" khỏi hợp đồng?`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            try {
              await store(storedRef.current.filter((f) => f.fileKey !== file.fileKey));
            } catch (error) {
              Alert.alert('Không xoá được tệp', errorText(error));
              if (isStale(error)) onStale();
            }
          }),
      },
    ]);

  return (
    <View className="gap-3">
      <EvidenceGallery files={stored} onRemove={busy ? undefined : remove} />
      <Text className="font-body text-body-sm text-muted">
        {stored.length}/{MAX_CONTRACT_FILES} tệp · chụp từng trang hợp đồng đã ký
      </Text>
      {busy ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" />
          <Text className="font-body text-body-sm text-muted">{status}</Text>
        </View>
      ) : null}
      <Button
        isDisabled={busy || remaining <= 0}
        onPress={() => void add((n) => pickImages('camera', n))}
      >
        <Button.Label>
          {remaining <= 0 ? `Tối đa ${MAX_CONTRACT_FILES} tệp` : 'Chụp ảnh'}
        </Button.Label>
      </Button>
      <View className="flex-row gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          isDisabled={busy || remaining <= 0}
          onPress={() => void add((n) => pickImages('library', n))}
        >
          <Button.Label>Chọn ảnh</Button.Label>
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          isDisabled={busy || remaining <= 0}
          onPress={() => void add(pickPdfs)}
        >
          <Button.Label>Chọn PDF</Button.Label>
        </Button>
      </View>
    </View>
  );
}
