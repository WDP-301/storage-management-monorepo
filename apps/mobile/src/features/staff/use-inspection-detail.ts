import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { InspectionsApi } from '../../../lib/inspections-api';
import type { InspectionUpdate, StaffInspection } from '../../types/inspection-api';

const toForm = (inspection: StaffInspection): InspectionUpdate => ({
  conditionNotes: inspection.conditionNotes,
  evidence: inspection.evidence,
  damages: inspection.damages,
});

/** API conflicts arrive in English; staff get the reason in Vietnamese. */
export function staffErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'FORBIDDEN' || error.statusCode === 403)
    return 'Bạn không có quyền với biên bản này.';
  const reason = [
    ['already finalized', 'Biên bản đã được chốt trước đó.'],
    [
      'Assign an inspector',
      'Biên bản chưa được phân công nhân viên — nhờ quản lý giao việc trước.',
    ],
    ['requires a', 'Hợp đồng không ở trạng thái phù hợp để chốt biên bản này.'],
    ['expected state', 'Trạng thái kho không khớp — liên hệ quản lý cơ sở.'],
  ].find(([needle]) => error.message.includes(needle));
  if (reason) return reason[1];
  // Message substrings above are best-effort; the error code is the stable signal.
  if (error.code === 'CONFLICT' || error.statusCode === 409)
    return 'Thao tác bị xung đột — tải lại biên bản rồi thử lại.';
  if (error.statusCode === 400) return 'Thông tin chưa hợp lệ, kiểm tra lại ghi chú và hư hỏng.';
  return error.message || fallback;
}

/** Fields whose edited value differs from the stored record; the rest stay untouched server-side. */
function changedFields(
  form: InspectionUpdate,
  inspection: StaffInspection,
): Partial<InspectionUpdate> {
  const stored = toForm(inspection);
  const changes: Partial<InspectionUpdate> = {};
  if (form.conditionNotes !== stored.conditionNotes) changes.conditionNotes = form.conditionNotes;
  if (JSON.stringify(form.evidence) !== JSON.stringify(stored.evidence)) {
    changes.evidence = form.evidence;
  }
  if (JSON.stringify(form.damages) !== JSON.stringify(stored.damages)) {
    changes.damages = form.damages.map((d) => ({ ...d, description: d.description.trim() }));
  }
  return changes;
}

/** Loads one inspection and keeps an editable copy; `isDirty` drives the unsaved-changes guard. */
export function useInspectionDetail(id: string | undefined) {
  const [inspection, setInspection] = useState<StaffInspection | null>(null);
  const [form, setForm] = useState<InspectionUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'saving' | 'finalizing' | null>(null);
  const [uploads, setUploads] = useState(0);
  // The route stays mounted across inspections: async results for a previous id are dropped.
  const idRef = useRef(id);
  idRef.current = id;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      try {
        const loaded = await InspectionsApi.get(id, signal);
        setInspection(loaded);
        setForm(toForm(loaded));
        setError(null);
      } catch (err) {
        if (!signal?.aborted) setError(staffErrorMessage(err, 'Không tải được biên bản.'));
      }
    },
    [id],
  );

  // The detail route stays mounted between visits: drop the previous record when the id
  // changes, and reload on every focus so a finalized record never reopens as editable.
  useEffect(() => {
    setInspection(null);
    setForm(null);
    setError(null);
    setUploads(0);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  /**
   * Edits go through the latest form (not the one captured when an upload started), so a
   * photo that finishes uploading never rolls back notes or damages typed meanwhile.
   */
  const updateForm = useCallback(
    (change: (current: InspectionUpdate) => InspectionUpdate) => {
      if (idRef.current !== id) return;
      setForm((current) => (current ? change(current) : current));
    },
    [id],
  );

  const trackUpload = useCallback((active: boolean) => {
    setUploads((count) => Math.max(0, count + (active ? 1 : -1)));
  }, []);

  const isDirty = useMemo(
    () =>
      inspection !== null &&
      form !== null &&
      Object.keys(changedFields(form, inspection)).length > 0,
    [form, inspection],
  );

  /** Every damage needs a description before it can be stored. */
  const validationError = form?.damages.some((damage) => damage.description.trim() === '')
    ? 'Nhập mô tả cho mọi hư hỏng.'
    : null;

  const save = async (): Promise<boolean> => {
    if (!id || !form || !inspection) return false;
    if (validationError) {
      setError(validationError);
      return false;
    }
    setBusy('saving');
    try {
      const saved = await InspectionsApi.update(id, changedFields(form, inspection));
      if (idRef.current === id) {
        setInspection(saved);
        setForm(toForm(saved));
        setError(null);
      }
      return true;
    } catch (err) {
      if (idRef.current === id) setError(staffErrorMessage(err, 'Không lưu được biên bản.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Saves pending edits first so the signed record is exactly what is on screen. */
  const finalize = async (): Promise<boolean> => {
    if (!id) return false;
    if (isDirty && !(await save())) return false;
    setBusy('finalizing');
    try {
      const done = await InspectionsApi.finalize(id);
      // Locks the screen at once instead of waiting for the next reload.
      if (idRef.current === id) {
        setInspection((current) =>
          current
            ? { ...current, finalizedAt: done.finalizedAt ?? new Date().toISOString() }
            : current,
        );
      }
      return true;
    } catch (err) {
      if (idRef.current === id) setError(staffErrorMessage(err, 'Không chốt được biên bản.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return {
    inspection,
    form,
    updateForm,
    error,
    busy,
    isDirty,
    isUploading: uploads > 0,
    trackUpload,
    save,
    finalize,
    reload: load,
  };
}
