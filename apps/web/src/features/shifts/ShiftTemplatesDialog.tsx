import { Badge, Button, Dialog, Input, Select } from '@cloudflare/kumo';
import { Clock, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { ShiftTemplateType } from '@storage/types';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { type ShiftTemplateRecord, StaffShiftsApi } from '../../lib/staff-shifts-api';
import { useAppToast } from '../../lib/toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

const TEMPLATE_TYPE_ITEMS: Array<{ value: ShiftTemplateType; label: string }> = [
  { value: ShiftTemplateType.OFFICE, label: 'Hành chính (OFFICE)' },
  { value: ShiftTemplateType.WAREHOUSE, label: 'Vận hành kho (WAREHOUSE)' },
];

const EMPTY_FORM = {
  code: '',
  name: '',
  type: ShiftTemplateType.WAREHOUSE as ShiftTemplateType,
  startTime: '08:00',
  endTime: '12:00',
  isActive: true,
};

const apiErrorMessage = (err: unknown, fallback: string): string => {
  const msg = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('; ');
  if (typeof msg === 'string' && msg) return msg;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

/**
 * Admin CRUD modal for `shift_templates` (`/admin/shift-templates`).
 * Always keeps `<Dialog.Root open={open}>` mounted per Kumo dialog stability rules.
 */
export const ShiftTemplatesDialog: React.FC<Props> = ({ open, onOpenChange, onChanged }) => {
  const toast = useAppToast();
  const [items, setItems] = useState<ShiftTemplateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await StaffShiftsApi.listAdminTemplates());
    } catch (e) {
      toast.error('Lỗi tải mẫu ca', apiErrorMessage(e, 'Không tải được danh sách mẫu ca.'));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    setEditingId(null);
    setForm(EMPTY_FORM);
    void loadTemplates();
  }, [open, loadTemplates]);

  const startEdit = (tpl: ShiftTemplateRecord) => {
    setEditingId(tpl.id);
    setForm({
      code: tpl.code,
      name: tpl.name,
      type: tpl.type ?? ShiftTemplateType.WAREHOUSE,
      startTime: tpl.start_time,
      endTime: tpl.end_time,
      isActive: tpl.is_active,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = form.code.trim().toUpperCase();
    const trimmedName = form.name.trim();
    if (!editingId && !/^[A-Z0-9_]{2,30}$/.test(trimmedCode)) {
      toast.warning(
        'Mã ca không hợp lệ',
        'Mã ca gồm 2-30 ký tự in hoa, chữ số hoặc dấu gạch dưới (VD: NIGHT_SHIFT).',
      );
      return;
    }
    if (!trimmedName) {
      toast.warning('Thiếu tên ca', 'Vui lòng nhập tên hiển thị của ca mẫu.');
      return;
    }
    if (!form.startTime || !form.endTime || form.startTime === form.endTime) {
      toast.warning('Giờ ca không hợp lệ', 'Giờ bắt đầu và giờ kết thúc phải khác nhau.');
      return;
    }

    setBusyId('submit');
    try {
      if (editingId) {
        await StaffShiftsApi.updateTemplate(editingId, {
          name: trimmedName,
          type: form.type,
          startTime: form.startTime,
          endTime: form.endTime,
          isActive: form.isActive,
        });
        toast.info('Đã cập nhật mẫu ca', trimmedName);
      } else {
        await StaffShiftsApi.createTemplate({
          code: trimmedCode,
          name: trimmedName,
          type: form.type,
          startTime: form.startTime,
          endTime: form.endTime,
          isActive: form.isActive,
        });
        toast.info('Đã thêm mẫu ca', `${trimmedName} (${trimmedCode})`);
      }
      resetForm();
      await loadTemplates();
      onChanged();
    } catch (err) {
      toast.error('Không lưu được mẫu ca', apiErrorMessage(err, 'Vui lòng kiểm tra lại giờ ca.'));
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (tpl: ShiftTemplateRecord) => {
    setBusyId(tpl.id);
    try {
      await StaffShiftsApi.updateTemplate(tpl.id, { isActive: !tpl.is_active });
      await loadTemplates();
      onChanged();
    } catch (err) {
      toast.error('Không cập nhật được trạng thái', apiErrorMessage(err, 'Vui lòng thử lại.'));
    } finally {
      setBusyId(null);
    }
  };

  const removeTemplate = async (tpl: ShiftTemplateRecord) => {
    setBusyId(tpl.id);
    try {
      await StaffShiftsApi.removeTemplate(tpl.id);
      if (editingId === tpl.id) resetForm();
      toast.info('Đã xóa mẫu ca', tpl.name);
      await loadTemplates();
      onChanged();
    } catch (err) {
      toast.error('Không xóa được mẫu ca', apiErrorMessage(err, 'Vui lòng thử lại.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog size="lg" className={`${DIALOG_SHELL} max-w-2xl sm:w-[680px] w-full`}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-kumo-brand" />
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              Quản lý mẫu ca làm việc
            </Dialog.Title>
          </div>
          <Dialog.Close
            render={
              <Button
                size="sm"
                variant="ghost"
                shape="square"
                icon={<X />}
                aria-label="Đóng hộp thoại mẫu ca"
              />
            }
          />
        </DialogHeader>

        <DialogBody className="space-y-4">
          <form
            onSubmit={handleSubmit}
            className="rounded-lg bg-kumo-control p-3.5 ring ring-kumo-line space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-kumo-default">
                {editingId ? `Đang sửa mẫu ca ${form.code}` : 'Thêm mẫu ca mới'}
              </span>
              {editingId && (
                <Button type="button" size="xs" variant="ghost" onClick={resetForm}>
                  Hủy sửa
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Mã ca"
                placeholder="VD: NIGHT_SHIFT"
                value={form.code}
                disabled={Boolean(editingId)}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
              />
              <Input
                label="Tên ca"
                placeholder="VD: Ca tối"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Select
                label="Loại ca"
                value={form.type}
                onValueChange={(value) =>
                  value && setForm((prev) => ({ ...prev, type: value as ShiftTemplateType }))
                }
                items={TEMPLATE_TYPE_ITEMS}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Bắt đầu"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                />
                <Input
                  label="Kết thúc"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-kumo-default cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Đang áp dụng để xếp ca
              </label>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                icon={<Plus />}
                disabled={busyId !== null}
                loading={busyId === 'submit'}
              >
                {editingId ? 'Lưu mẫu ca' : 'Thêm mẫu ca'}
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-kumo-default block">
              Danh sách mẫu ca ({items.length})
            </span>
            {loading ? (
              <p className="text-xs text-kumo-secondary py-4 text-center">Đang tải danh sách...</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-kumo-secondary py-4 text-center">Chưa có mẫu ca nào.</p>
            ) : (
              <div className="divide-y divide-kumo-line rounded-lg ring ring-kumo-line bg-kumo-base">
                {items.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-kumo-default">{tpl.name}</span>
                        <span className="font-mono text-[11px] text-kumo-subtle">{tpl.code}</span>
                        <Badge variant={tpl.is_active ? 'success' : 'neutral'}>
                          {tpl.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                        </Badge>
                        {tpl.type && (
                          <Badge variant="neutral">
                            {tpl.type === ShiftTemplateType.OFFICE ? 'Hành chính' : 'Vận hành kho'}
                          </Badge>
                        )}
                      </div>
                      <p className="font-mono text-kumo-secondary">
                        {tpl.start_time} – {tpl.end_time}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={busyId !== null}
                        onClick={() => void toggleActive(tpl)}
                      >
                        {tpl.is_active ? 'Tạm ngưng' : 'Kích hoạt'}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        shape="square"
                        icon={<PencilSimple />}
                        aria-label={`Sửa ${tpl.name}`}
                        disabled={busyId !== null}
                        onClick={() => startEdit(tpl)}
                      />
                      <Button
                        size="xs"
                        variant="ghost"
                        shape="square"
                        icon={<Trash />}
                        aria-label={`Xóa ${tpl.name}`}
                        disabled={busyId !== null}
                        onClick={() => void removeTemplate(tpl)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </Dialog>
    </Dialog.Root>
  );
};
