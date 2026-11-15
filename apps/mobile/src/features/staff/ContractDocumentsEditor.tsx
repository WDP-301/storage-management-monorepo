import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ApiError } from '../../../lib/api';
import { ContractDocumentsApi } from '../../../lib/contract-documents-api';
import {
  MAX_CONTRACT_FILE_BYTES,
  MAX_CONTRACT_FILES,
  splitBySize,
} from '../../../lib/contract-files';
import { type PickedFile, UploadsApi } from '../../../lib/uploads-api';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import { AlertSheet, Button, colors, InlineMessage, Text } from '../../components/ui';
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
  if (error.statusCode === 400) {
    return 'Tệp không hợp lệ — chỉ nhận ảnh JPG, PNG, WEBP, HEIC hoặc PDF, tối đa 10 tệp.';
  }
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
  const [feedback, setFeedback] = useState<{ type: 'error' | 'warning'; message: string } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<EvidenceFile | null>(null);
  const deleteSheetRef = useRef<BottomSheetModal>(null);
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
      setFeedback(null);
      let picked: PickedFile[];
      try {
        picked = await pick(MAX_CONTRACT_FILES - storedRef.current.length);
      } catch {
        setFeedback({
          type: 'error',
          message: 'Không mở được trình chọn tệp. Cập nhật ứng dụng rồi thử lại.',
        });
        return;
      }
      const { accepted, tooLarge } = splitBySize(picked);
      if (tooLarge.length > 0) {
        setFeedback({
          type: 'warning',
          message: `Tệp vượt quá ${MAX_CONTRACT_FILE_BYTES / 1024 / 1024}MB: ${tooLarge
            .map((f) => f.name)
            .join(', ')}`,
        });
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
        if (failure) {
          setFeedback({ type: 'error', message: `Tải tệp thất bại: ${errorText(failure)}` });
        }
      } catch (error) {
        setFeedback({ type: 'error', message: `Không lưu được hợp đồng: ${errorText(error)}` });
        if (isStale(error)) onStale();
      }
    });

  const confirmRemove = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    void run(async () => {
      setFeedback(null);
      try {
        await store(storedRef.current.filter((f) => f.fileKey !== target.fileKey));
      } catch (error) {
        setFeedback({ type: 'error', message: `Không xoá được tệp: ${errorText(error)}` });
        if (isStale(error)) onStale();
      }
    });
  };

  return (
    <View className="gap-3">
      <EvidenceGallery
        files={stored}
        onRemove={
          busy
            ? undefined
            : (file) => {
                setPendingDelete(file);
                deleteSheetRef.current?.present();
              }
        }
      />
      <Text className="text-caption text-text-secondary">
        {stored.length}/{MAX_CONTRACT_FILES} tệp · chụp từng trang hợp đồng đã ký
      </Text>
      {busy ? (
        <View className="flex-row items-center gap-2">
          <ActivityIndicator color={colors.semantic.actionPrimary} size="small" />
          <Text className="text-body text-text-secondary">{status}</Text>
        </View>
      ) : null}
      {feedback ? <InlineMessage message={feedback.message} type={feedback.type} /> : null}
      <Button
        disabled={busy || remaining <= 0}
        fullWidth
        label={remaining <= 0 ? `Tối đa ${MAX_CONTRACT_FILES} tệp` : 'Chụp ảnh'}
        leftIcon={remaining <= 0 ? undefined : 'photo-camera'}
        onPress={() => void add((n) => pickImages('camera', n))}
      />
      <View className="flex-row gap-2.5">
        <Button
          className="flex-1"
          disabled={busy || remaining <= 0}
          label="Chọn ảnh"
          leftIcon="photo-library"
          onPress={() => void add((n) => pickImages('library', n))}
          size="sm"
          variant="secondary"
        />
        <Button
          className="flex-1"
          disabled={busy || remaining <= 0}
          label="Chọn PDF"
          leftIcon="picture-as-pdf"
          onPress={() => void add(pickPdfs)}
          size="sm"
          variant="secondary"
        />
      </View>

      <AlertSheet
        actionsLayout="row"
        destructive
        message={pendingDelete ? `Xoá "${pendingDelete.name}" khỏi hợp đồng?` : ''}
        onDismiss={() => setPendingDelete(null)}
        onPrimary={confirmRemove}
        primaryLabel="Xoá"
        ref={deleteSheetRef}
        secondaryLabel="Huỷ"
        title="Xoá tệp?"
      />
    </View>
  );
}
