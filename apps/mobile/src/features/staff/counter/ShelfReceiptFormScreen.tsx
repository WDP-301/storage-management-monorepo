import type { ShelfReceiptType } from '@storage/types';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { Button } from 'heroui-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native';
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
import { ScreenHeader } from '../../../components/ScreenHeader';
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
    Alert.alert(
      'Thu hồi đồ?',
      `Thu hồi đồ của ${source?.customerName || 'khách'} trên kệ ${source?.shelfCode}. Khách sẽ được thông báo.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Thu hồi', style: 'destructive', onPress: () => void save() },
      ],
    );
  };

  const title = recovery ? 'Thu hồi đồ' : type === 'DROP_OFF' ? 'Nhận đồ gửi' : 'Trả đồ cho khách';
  const needsPhoto = type === 'DROP_OFF' || recovery;
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={title} backLabel="Quay lại Gửi / lấy đồ" onBack={confirmLeave} />
      <ScrollView contentContainerClassName="gap-4 px-4 pb-10" keyboardShouldPersistTaps="handled">
        {loadError ? (
          <View className="gap-2 rounded-xl bg-danger-bg p-3">
            <Text className="font-body text-body-sm text-danger">{loadError}</Text>
            <Button size="sm" variant="secondary" onPress={() => void reload()}>
              <Button.Label>Thử lại</Button.Label>
            </Button>
          </View>
        ) : !source || !draft ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text className="font-body text-body-sm text-muted">
              {source.customerName ? `${source.customerName} · ` : ''}Kệ {source.shelfCode} ·{' '}
              {source.contractNo}
            </Text>
            {recovery ? (
              <Text className="rounded-xl bg-warning-bg p-3 font-body text-body-sm text-warning">
                Thu hồi đồ của khách bỏ kệ — khách sẽ được thông báo.
              </Text>
            ) : null}
            {type === 'DROP_OFF' ? (
              <DropOffLinesEditor draft={draft} existing={source.items} onChange={edit} />
            ) : (
              <PickUpLinesEditor draft={draft} onChange={edit} />
            )}

            <View className="gap-1.5">
              <Text className="font-ui text-body-sm text-foreground">
                Ảnh{needsPhoto ? ' (bắt buộc)' : ''}
              </Text>
              {needsPhoto && photos.length === 0 ? (
                <Text className="font-body text-caption text-muted">
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

            <TextInput
              accessibilityLabel="Ghi chú"
              className="min-h-20 rounded-xl border border-border bg-surface px-3 py-3 font-body text-body-sm text-foreground"
              maxLength={1000}
              multiline
              placeholder={
                recovery ? 'Ghi chú lý do thu hồi (bắt buộc)' : 'Ghi chú (không bắt buộc)'
              }
              textAlignVertical="top"
              value={note}
              onChangeText={(text) => {
                setTouched(true);
                setNote(text);
              }}
            />

            {error ? (
              <Text className="rounded-xl bg-danger-bg p-3 font-body text-body-sm text-danger">
                {error}
              </Text>
            ) : null}
            <Button isDisabled={saving || uploading || saved} onPress={confirmSave}>
              <Button.Label>
                {saving ? 'Đang lưu…' : uploading ? 'Đang tải ảnh…' : 'Lưu phiếu'}
              </Button.Label>
            </Button>
          </>
        )}
      </ScrollView>
    </View>
  );
}
