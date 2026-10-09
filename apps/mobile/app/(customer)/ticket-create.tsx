import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { TicketsApi } from '../../lib/tickets-api';
import { type PickedFile, UploadsApi } from '../../lib/uploads-api';
import {
  type CreateTicketForm,
  CreateTicketScreen,
} from '../../src/features/customer/CreateTicketScreen';
import type { TicketFormOptions } from '../../src/types/ticket-api';

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
  // One idempotency key per mount — a retry after a failed submit must reuse it,
  // not mint a new one, or the server-side dedup is defeated.
  const idempotencyKey = useRef(TicketsApi.newIdempotencyKey());
  const [options, setOptions] = useState<TicketFormOptions | null>(null);
  const [form, setForm] = useState<CreateTicketForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preset = useLocalSearchParams<{ facilityId?: string; storageUnitId?: string }>();
  const appliedPreset = useRef<string | null>(null);

  const loadOptions = useCallback(async () => {
    setError(null);
    try {
      setOptions(await TicketsApi.formOptions());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tải được dữ liệu.');
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
        attachments.push(await UploadsApi.uploadImage(photo));
      }
      const ticket = await TicketsApi.create(
        {
          typeId: form.typeId,
          facilityId: form.facilityId,
          ...(form.storageUnitId ? { storageUnitId: form.storageUnitId } : {}),
          subject: form.subject,
          description: form.description,
          attachments,
        },
        idempotencyKey.current,
      );
      router.replace(`/(customer)/ticket-detail?id=${ticket.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không gửi được yêu cầu. Thử lại.');
      // The rental window may have moved — refresh options so a stale facility does not
      // keep offering itself. Keep the typed fields intact either way.
      void loadOptions();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CreateTicketScreen
      options={options}
      error={error}
      form={form}
      isSubmitting={isSubmitting}
      onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
      onPickPhotos={() => void pickPhotos()}
      onRemovePhoto={(uri) =>
        setForm((prev) => ({ ...prev, photos: prev.photos.filter((p) => p.uri !== uri) }))
      }
      onSubmit={() => void submit()}
      onRetryOptions={() => void loadOptions()}
      onBack={() => router.navigate('/(customer)/tickets')}
    />
  );
}
