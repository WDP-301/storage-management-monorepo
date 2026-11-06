import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import {
  disputeDescription,
  disputeErrorMessage,
  disputeFormOptions,
  disputeSubject,
  isDisputeEnding,
  supportTypeId,
} from '../../lib/receipt-dispute';
import { TicketsApi } from '../../lib/tickets-api';
import { type PickedFile, UploadsApi } from '../../lib/uploads-api';
import {
  type CreateTicketForm,
  CreateTicketScreen,
} from '../../src/features/customer/CreateTicketScreen';
import { useReceiptDispute } from '../../src/features/customer/use-receipt-dispute';
import type { TicketAttachment, TicketFormOptions } from '../../src/types/ticket-api';

const MAX_ATTACHMENTS = 5;

const EMPTY_FORM: CreateTicketForm = {
  facilityId: null,
  storageUnitId: null,
  typeId: null,
  subject: '',
  description: '',
  photos: [],
};

export default function TicketCreateRoute() {
  const router = useRouter();
  // One idempotency key per ticket — a retry after a failed submit must reuse it, not mint a
  // new one, or the server-side dedup is defeated. This tab screen never unmounts, so the key is
  // replaced once a ticket is created; otherwise the next ticket would replay the previous one.
  const idempotencyKey = useRef(TicketsApi.newIdempotencyKey());
  // Photos already uploaded, by local uri: a retry must send the same file keys, or the request
  // would no longer match the one the idempotency key was first used with.
  const uploaded = useRef(new Map<string, TicketAttachment>());
  const [options, setOptions] = useState<TicketFormOptions | null>(null);
  const [form, setForm] = useState<CreateTicketForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preset = useLocalSearchParams<{
    facilityId?: string;
    storageUnitId?: string;
    shelfReceiptId?: string;
    nonce?: string;
  }>();
  const appliedPreset = useRef<string | null>(null);
  // Reporting a wrong receipt: the receipt comes from the route, and `leftKey` marks the visit whose
  // dispute mode already ended (submitted, backed out or left) so the lingering tab params cannot revive it.
  const dispute = useReceiptDispute(preset.shelfReceiptId, preset.nonce);
  const [leftKey, setLeftKey] = useState<string | null>(null);
  const disputeReceipt = dispute.key !== leftKey ? dispute.receipt : null;
  const disputeNotice = dispute.key !== leftKey ? dispute.notice : null;
  // Tracked from the first render, not once the receipt has loaded: leaving while it still loads
  // must end the visit too, or the late response would fill the form of a screen nobody is on.
  const visitKey = useRef<string | null>(null);
  visitKey.current = dispute.key;
  const leftKeyRef = useRef<string | null>(null);
  const appliedDispute = useRef<string | null>(null);
  const formOptions =
    options && disputeReceipt ? disputeFormOptions(options, disputeReceipt) : options;

  const endDispute = useCallback(() => {
    const key = visitKey.current;
    // No dispute in the route, or this visit already ended: a normal draft stays untouched.
    if (!key || key === leftKeyRef.current) return;
    leftKeyRef.current = key;
    setLeftKey(key);
    setForm(EMPTY_FORM);
    if (appliedDispute.current === key) {
      // The dispute filled the form, so the next ticket must not reuse its key or uploads (the
      // server would answer 422 for a different body under the same key).
      idempotencyKey.current = TicketsApi.newIdempotencyKey();
      uploaded.current.clear();
    }
  }, []);
  // Leaving the tab ends the report; the next tap on "Báo sai phiếu" brings a new nonce.
  useFocusEffect(useCallback(() => endDispute, [endDispute]));

  useEffect(() => {
    if (!options || !disputeReceipt || appliedDispute.current === dispute.key) return;
    appliedDispute.current = dispute.key;
    setForm({
      ...EMPTY_FORM,
      facilityId: disputeReceipt.facility.id,
      typeId: supportTypeId(options.types),
      subject: disputeSubject(disputeReceipt.code),
      description: disputeDescription(disputeReceipt),
    });
  }, [options, disputeReceipt, dispute.key]);

  const loadOptions = useCallback(async () => {
    setError(null);
    try {
      setOptions(await TicketsApi.formOptions());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tải được dữ liệu.');
    }
  }, []);

  // Background refresh after a failed submit: it must not clear the submit error, and a failed
  // refresh keeps the options already shown instead of replacing that error.
  const refreshOptions = useCallback(async () => {
    try {
      setOptions(await TicketsApi.formOptions());
    } catch {
      // Stale options are still usable; the submit error stays on screen.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOptions();
    }, [loadOptions]),
  );

  // Opened from a contract: preselect its facility/unit once the options confirm the customer can
  // file against them. Applied once per preset so option reloads never undo a manual change.
  useEffect(() => {
    if (!options || (!preset.facilityId && !preset.storageUnitId)) return;
    const key = `${preset.facilityId ?? ''}:${preset.storageUnitId ?? ''}`;
    if (appliedPreset.current === key) return;
    const facility = options.facilities.find((f) =>
      preset.facilityId
        ? f.id === preset.facilityId
        : f.units.some((u) => u.id === preset.storageUnitId),
    );
    if (!facility) return;
    appliedPreset.current = key;
    const unit = facility.units.find((u) => u.id === preset.storageUnitId);
    setForm((prev) => ({ ...prev, facilityId: facility.id, storageUnitId: unit?.id ?? null }));
  }, [options, preset.facilityId, preset.storageUnitId]);

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_ATTACHMENTS - form.photos.length,
    });
    if (result.canceled) return;
    const picked: PickedFile[] = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${index + 1}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
    }));
    setForm((prev) => ({
      ...prev,
      photos: [...prev.photos, ...picked].slice(0, MAX_ATTACHMENTS),
    }));
  };

  const submit = async () => {
    if (!form.facilityId || !form.typeId || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const attachments = [];
      for (const photo of form.photos) {
        let file = uploaded.current.get(photo.uri);
        if (!file) {
          file = await UploadsApi.uploadFile(photo);
          uploaded.current.set(photo.uri, file);
        }
        attachments.push(file);
      }
      const ticket = await TicketsApi.create(
        {
          typeId: form.typeId,
          facilityId: form.facilityId,
          // The server derives the shelf from the receipt and rejects a unit sent alongside it.
          ...(disputeReceipt
            ? { shelfReceiptId: disputeReceipt.id }
            : form.storageUnitId
              ? { storageUnitId: form.storageUnitId }
              : {}),
          subject: form.subject,
          description: form.description,
          attachments,
        },
        idempotencyKey.current,
      );
      // Start the next ticket from a clean form with its own key.
      idempotencyKey.current = TicketsApi.newIdempotencyKey();
      uploaded.current.clear();
      appliedPreset.current = null;
      setForm(EMPTY_FORM);
      endDispute();
      router.replace(`/(customer)/ticket-detail?id=${ticket.id}`);
    } catch (e) {
      setError(
        disputeReceipt
          ? disputeErrorMessage(e)
          : e instanceof ApiError
            ? e.message
            : 'Không gửi được yêu cầu. Thử lại.',
      );
      // The rental window may have moved — refresh options so a stale facility does not
      // keep offering itself. Keep the typed fields intact either way.
      void refreshOptions();
      // The receipt was voided, already reported or is gone: nothing left to report on it.
      if (disputeReceipt && isDisputeEnding(e)) endDispute();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CreateTicketScreen
      options={formOptions}
      error={error ?? disputeNotice}
      linkedReceiptCode={disputeReceipt?.code}
      form={form}
      isSubmitting={isSubmitting}
      onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      onPickPhotos={() => void pickPhotos()}
      onRemovePhoto={(uri) =>
        setForm((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.uri !== uri) }))
      }
      onSubmit={() => void submit()}
      onRetryOptions={() => void loadOptions()}
      onBack={() => {
        endDispute();
        router.navigate('/(customer)/tickets');
      }}
    />
  );
}
