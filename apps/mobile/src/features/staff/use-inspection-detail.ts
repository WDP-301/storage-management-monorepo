import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  if (error.statusCode === 403) return 'Bạn không có quyền với biên bản này.';
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
  if (error.statusCode === 400) return 'Thông tin chưa hợp lệ, kiểm tra lại ghi chú và hư hỏng.';
  return error.message || fallback;
}

/** Loads one inspection and keeps an editable copy; `isDirty` drives the unsaved-changes guard. */
export function useInspectionDetail(id: string | undefined) {
  const [inspection, setInspection] = useState<StaffInspection | null>(null);
  const [form, setForm] = useState<InspectionUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'saving' | 'finalizing' | null>(null);

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
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
    }, [load]),
  );

  const isDirty = useMemo(
    () =>
      inspection !== null &&
      form !== null &&
      JSON.stringify(form) !== JSON.stringify(toForm(inspection)),
    [form, inspection],
  );

  /** Every damage needs a description before it can be stored. */
  const validationError = form?.damages.some((damage) => damage.description.trim() === '')
    ? 'Nhập mô tả cho mọi hư hỏng.'
    : null;

  const save = async (): Promise<boolean> => {
    if (!id || !form) return false;
    if (validationError) {
      setError(validationError);
      return false;
    }
    setBusy('saving');
    try {
      const saved = await InspectionsApi.update(id, {
        ...form,
        damages: form.damages.map((d) => ({ ...d, description: d.description.trim() })),
      });
      setInspection(saved);
      setForm(toForm(saved));
      setError(null);
      return true;
    } catch (err) {
      setError(staffErrorMessage(err, 'Không lưu được biên bản.'));
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
      await InspectionsApi.finalize(id);
      return true;
    } catch (err) {
      setError(staffErrorMessage(err, 'Không chốt được biên bản.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { inspection, form, setForm, error, busy, isDirty, save, finalize, reload: load };
}
