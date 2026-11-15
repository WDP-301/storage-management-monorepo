import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { ShelfReceiptType } from '@storage/types';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { newOpenNonce } from '../../../../lib/open-nonce';
import {
  newDraft,
  prefillDropOff,
  prefillPickUp,
  type ReceiptDraft,
  toReceiptInput,
  toRecoveryInput,
} from '../../../../lib/shelf-receipt-draft';
import { ShelfStorageApi } from '../../../../lib/shelf-storage-api';
import {
  AlertSheet,
  Button,
  colors,
  FieldLabel,
  FlowScreen,
  InlineMessage,
  Input,
  Text,
} from '../../../components/ui';
import type { EvidenceFile } from '../../../types/contract-api';
import { EvidenceEditor } from '../EvidenceEditor';
import { shelfApiError } from '../staff-errors';
import { DropOffLinesEditor } from './DropOffLinesEditor';
import { PickUpLinesEditor } from './PickUpLinesEditor';
import { useLeaveGuard } from './use-leave-guard';
import { useReceiptFormSource } from './use-receipt-form-source';

export type ReceiptFormParams = {
  recovery: boolean;
  type: ShelfReceiptType;
  sessionId?: string;
  contractId: string;
  requestId?: string;
  customerName?: string;
};

const MAX_PHOTOS = 10;

/** Drop-off / pick-up receipt, or a manager's recovery of an abandoned shelf, built from the shelf's fresh stock. */
export function ShelfReceiptFormScreen({ params }: { params: ReceiptFormParams }) {
  const router = useRouter();
  const { recovery, type, requestId } = params;
  const { source, error: loadError, reload } = useReceiptFormSource(params);
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [photos, setPhotos] = useState<EvidenceFile[]>([]);
  const [note, setNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const recoverySheetRef = useRef<BottomSheetModal>(null);
  // One id per form: a retry after a timeout replays on the server instead of saving twice.
  const clientRequestId = useRef(Crypto.randomUUID()).current;

  useEffect(() => {
    if (!source || draft) return;
    setDraft(
      type === 'DROP_OFF'
        ? source.dropOffLines.length > 0
          ? prefillDropOff(source.dropOffLines)
          : newDraft('DROP_OFF')
        : prefillPickUp(source.items, source.requestLines),
    );
  }, [source, draft, type]);

  const goBack = () => router.navigate('/(staff)/scan');
  const confirmLeave = useLeaveGuard((touched || uploading || saving) && !saved, goBack);

  const edit = (next: ReceiptDraft) => {
    setTouched(true);
    setDraft(next);
  };

  const save = async () => {
    if (!draft || !source) return;
    const built = recovery
      ? toRecoveryInput(draft, { clientRequestId, contractId: params.contractId, photos, note })
      : toReceiptInput(draft, {
          clientRequestId,
          sessionId: params.sessionId ?? '',
          contractId: params.contractId,
          photos,
          note,
          // A form opened from a customer request always completes that request. Items the
          // customer brings or takes on a later visit go on a walk-in receipt.
          ...(requestId
            ? type === 'DROP_OFF'
              ? { dropOffRequestId: requestId }
              : { pickupRequestId: requestId }
            : {}),
        });
    if ('error' in built) {
      setError(built.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const receipt =
        'sessionId' in built.input
          ? await ShelfStorageApi.createReceipt(built.input)
          : await ShelfStorageApi.createRecovery(built.input);
      setSaved(true);
      router.replace({
        pathname: '/(staff)/shelf-receipt',
        params: { id: receipt.id, nonce: newOpenNonce() },
      });
    } catch (cause) {
      setError(shelfApiError(cause, 'Không lưu được phiếu. Thử lại.'));
      setSaving(false);
    }
  };

  const confirmSave = () => {
    if (!recovery) return void save();
    recoverySheetRef.current?.present();
  };

  const title = recovery ? 'Thu hồi đồ' : type === 'DROP_OFF' ? 'Nhận đồ gửi' : 'Trả đồ cho khách';
  const needsPhoto = type === 'DROP_OFF' || recovery;
  return (
    <FlowScreen backLabel="Quay lại Gửi / lấy đồ" muted onBack={confirmLeave} title={title}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 py-4 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        {loadError ? (
          <View className="gap-3 rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
            <InlineMessage message={loadError} type="error" />
            <Button label="Thử lại" onPress={() => void reload()} size="sm" variant="secondary" />
          </View>
        ) : !source || !draft ? (
          <ActivityIndicator className="py-6" color={colors.semantic.actionPrimary} />
        ) : (
          <>
            <View className="gap-1 rounded-[20px] border border-border-default bg-bg-card p-4">
              <Text className="text-body-lg font-semibold text-text-primary">
                {source.customerName || 'Khách hàng'}
              </Text>
              <Text className="text-caption text-text-secondary">
                Kệ {source.shelfCode} · {source.contractNo}
              </Text>
            </View>

            {recovery ? (
              <View className="rounded-[20px] border border-warning-200 bg-warning-0 p-4">
                <InlineMessage
                  message="Thu hồi đồ của khách bỏ kệ — khách sẽ được thông báo."
                  type="warning"
                />
              </View>
            ) : null}

            {type === 'DROP_OFF' ? (
              <DropOffLinesEditor draft={draft} existing={source.items} onChange={edit} />
            ) : (
              <PickUpLinesEditor draft={draft} onChange={edit} />
            )}

            <View className="gap-2 rounded-[20px] border border-border-default bg-bg-card p-4">
              <FieldLabel required={needsPhoto}>Ảnh</FieldLabel>
              {needsPhoto && photos.length === 0 ? (
                <Text className="text-caption text-text-secondary">
                  {recovery ? 'Cần ít nhất 1 ảnh đồ thu hồi' : 'Cần ít nhất 1 ảnh đồ nhận'}
                </Text>
              ) : null}
              <EvidenceEditor
                files={photos}
                max={MAX_PHOTOS}
                onAdd={(added) => {
                  setTouched(true);
                  setPhotos((prev) => [...prev, ...added]);
                }}
                onRemove={(file) =>
                  setPhotos((prev) => prev.filter((p) => p.fileKey !== file.fileKey))
                }
                onUploadingChange={setUploading}
              />
            </View>

            <View className="rounded-[20px] border border-border-default bg-bg-card p-4">
              <Input
                accessibilityLabel="Ghi chú"
                label="Ghi chú"
                maxLength={1000}
                multiline
                onChangeText={(text) => {
                  setTouched(true);
                  setNote(text);
                }}
                placeholder={
                  recovery ? 'Ghi chú lý do thu hồi (bắt buộc)' : 'Ghi chú (không bắt buộc)'
                }
                required={recovery}
                value={note}
              />
            </View>

            {error ? (
              <View className="rounded-[20px] border border-border-error/30 bg-danger-0 p-4">
                <InlineMessage message={error} type="error" />
              </View>
            ) : null}

            <Button
              disabled={saving || uploading || saved}
              fullWidth
              label={saving ? 'Đang lưu…' : uploading ? 'Đang tải ảnh…' : 'Lưu phiếu'}
              loading={saving || uploading}
              onPress={confirmSave}
            />
          </>
        )}
      </ScrollView>

      <AlertSheet
        actionsLayout="row"
        destructive
        message={`Thu hồi đồ của ${source?.customerName || 'khách'} trên kệ ${source?.shelfCode}. Khách sẽ được thông báo.`}
        onPrimary={() => void save()}
        primaryLabel="Thu hồi"
        ref={recoverySheetRef}
        secondaryLabel="Hủy"
        title="Thu hồi đồ?"
      />
    </FlowScreen>
  );
}
