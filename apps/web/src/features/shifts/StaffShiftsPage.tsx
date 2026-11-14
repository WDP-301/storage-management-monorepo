import {
  Badge,
  Button,
  Combobox,
  Dialog,
  Input,
  LayerCard,
  Select,
  Table,
  Text,
  Textarea,
} from '@cloudflare/kumo';
import {
  CalendarCheck,
  CaretLeft,
  CaretRight,
  CircleNotch,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import type { StaffShiftStatus } from '@storage/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DateField } from '../../components/DateField';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { useFacility } from '../../context/FacilityContext';
import { FacilitiesApi } from '../../lib/api';
import {
  type AutoScheduleResult,
  type ShiftTemplateRecord,
  type StaffShiftRecord,
  StaffShiftsApi,
} from '../../lib/staff-shifts-api';
import { useAppToast } from '../../lib/toast';
import { addDays, formatVnDay, vnToday } from '../../lib/vn-day';
import type { FacilityStaffMember } from '../../types/inspection';
import { shiftCalendarRows } from './shift-calendar-rows';

const STATUS_DISPLAY: Record<
  StaffShiftStatus,
  { label: string; variant: 'info' | 'warning' | 'success' | 'error' | 'neutral' }
> = {
  SCHEDULED: { label: 'Đã xếp', variant: 'info' },
  CHECKED_IN: { label: 'Đang làm', variant: 'warning' },
  COMPLETED: { label: 'Xong ca', variant: 'success' },
  ABSENT: { label: 'Vắng', variant: 'error' },
  CANCELLED: { label: 'Đã hủy', variant: 'neutral' },
};

const DAY_NAME = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const VN_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dayName = (day: string): string => DAY_NAME[new Date(`${day}T12:00:00Z`).getUTCDay()];

/** Monday of the VN week containing `day` (YYYY-MM-DD). */
const mondayOf = (day: string): string =>
  addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));

const eachDay = (from: string, to: string): string[] => {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
};

const timeOf = (at: string): string => VN_TIME.format(new Date(at));

type StaffOption = { value: string; label: string; phone: string | null };

const errMsg = (e: unknown, fallback: string): string => {
  const err = e as { response?: { data?: { message?: string | string[] } } };
  const msg = err?.response?.data?.message;
  return Array.isArray(msg) ? msg.join('. ') : msg || fallback;
};

export const StaffShiftsPage: React.FC = () => {
  const toast = useAppToast();
  const { selectedFacility } = useFacility();
  const facilityId = selectedFacility?.id ?? '';

  const [viewDate, setViewDate] = useState(() => vnToday());
  const weekStart = mondayOf(viewDate);
  const [shifts, setShifts] = useState<StaffShiftRecord[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplateRecord[]>([]);
  const [staff, setStaff] = useState<FacilityStaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    templateId: '',
    staffIds: [] as string[],
    from: '',
    to: '',
    note: '',
  });
  const [staffQuery, setStaffQuery] = useState('');
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoHeadcount, setAutoHeadcount] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<AutoScheduleResult | null>(null);
  const [detail, setDetail] = useState<StaffShiftRecord | null>(null);
  const [detailNote, setDetailNote] = useState('');
  const [busy, setBusy] = useState<'schedule' | 'auto' | 'save' | 'cancel' | null>(null);

  const weekDays = useMemo(() => eachDay(weekStart, addDays(weekStart, 6)), [weekStart]);
  const calendarRows = useMemo(() => shiftCalendarRows(templates, shifts), [templates, shifts]);

  const { contains: staffMatches } = Combobox.useFilter({ locale: 'vi' });
  const selectedStaff = useMemo(
    () => staff.filter((m) => scheduleForm.staffIds.includes(m.id)),
    [staff, scheduleForm.staffIds],
  );
  const staffOptions = useMemo(
    () =>
      staff
        .filter((m) => !scheduleForm.staffIds.includes(m.id))
        .map((m) => ({ value: m.id, label: m.fullName, phone: m.phone })),
    [staff, scheduleForm.staffIds],
  );

  const load = useCallback(async () => {
    if (!facilityId) return;
    setLoading(true);
    try {
      const [list, tpls, members] = await Promise.all([
        StaffShiftsApi.list({ facilityId, from: weekStart, to: addDays(weekStart, 6) }),
        StaffShiftsApi.templates(),
        FacilitiesApi.listStaff(facilityId),
      ]);
      setShifts(list);
      setTemplates(tpls);
      setStaff(members);
    } catch (e) {
      toast.error('Lỗi tải dữ liệu', errMsg(e, 'Không tải được lịch ca.'));
    } finally {
      setLoading(false);
    }
  }, [facilityId, weekStart, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openSchedule = () => {
    setScheduleForm({ templateId: '', staffIds: [], from: weekStart, to: weekStart, note: '' });
    setStaffQuery('');
    setScheduleOpen(true);
  };

  const openAuto = () => {
    setAutoHeadcount(Object.fromEntries(templates.map((t) => [t.id, 1])));
    setPreview(null);
    setAutoOpen(true);
  };

  const openDetail = (s: StaffShiftRecord) => {
    setDetail(s);
    setDetailNote(s.note ?? '');
  };

  const submitSchedule = async () => {
    if (
      !scheduleForm.templateId ||
      scheduleForm.staffIds.length === 0 ||
      !scheduleForm.from ||
      !scheduleForm.to
    ) {
      toast.error('Thiếu thông tin', 'Chọn ca, ít nhất một nhân viên và khoảng ngày.');
      return;
    }
    if (scheduleForm.from > scheduleForm.to) {
      toast.error('Khoảng ngày sai', 'Ngày bắt đầu phải trước ngày kết thúc.');
      return;
    }
    if (eachDay(scheduleForm.from, scheduleForm.to).length > 31) {
      toast.error('Khoảng ngày quá dài', 'Tối đa 31 ngày mỗi lần xếp ca.');
      return;
    }
    setBusy('schedule');
    try {
      await StaffShiftsApi.create({
        facilityId,
        shiftTemplateId: scheduleForm.templateId,
        staffIds: scheduleForm.staffIds,
        workDates: eachDay(scheduleForm.from, scheduleForm.to),
        note: scheduleForm.note.trim() || undefined,
      });
      toast.success('Đã xếp ca', `${scheduleForm.staffIds.length} nhân viên đã được xếp ca.`);
      setScheduleOpen(false);
      await load();
    } catch (e) {
      toast.error('Không xếp được ca', errMsg(e, 'Ca trùng lịch hoặc nhân viên không hợp lệ.'));
    } finally {
      setBusy(null);
    }
  };

  const runAuto = async (dryRun: boolean) => {
    const requirements = Object.entries(autoHeadcount)
      .filter(([, n]) => n > 0)
      .map(([shiftTemplateId, staffPerShift]) => ({ shiftTemplateId, staffPerShift }));
    if (requirements.length === 0) {
      toast.error('Chưa nhập số lượng', 'Nhập số nhân viên cần cho ít nhất một ca.');
      return;
    }
    setBusy('auto');
    try {
      const res = await StaffShiftsApi.autoSchedule({
        facilityId,
        from: weekStart,
        to: addDays(weekStart, 6),
        requirements,
        dryRun,
      });
      if (dryRun) {
        setPreview(res);
      } else {
        toast.success('Đã xếp ca tự động', `${res.planned.length} ca đã được tạo.`);
        setAutoOpen(false);
        await load();
      }
    } catch (e) {
      toast.error('Không xếp được', errMsg(e, 'Kiểm tra lại khoảng ngày và ca mẫu.'));
    } finally {
      setBusy(null);
    }
  };

  const saveNote = async () => {
    if (!detail) return;
    setBusy('save');
    try {
      const updated = await StaffShiftsApi.update(detail.id, { note: detailNote.trim() || null });
      setDetail(updated);
      setShifts((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      toast.success('Đã lưu ghi chú');
    } catch (e) {
      toast.error('Không lưu được', errMsg(e, 'Ca đã bắt đầu nên chỉ sửa được ghi chú.'));
    } finally {
      setBusy(null);
    }
  };

  const cancelShift = async () => {
    if (!detail) return;
    setBusy('cancel');
    try {
      await StaffShiftsApi.cancel(detail.id);
      toast.success('Đã hủy ca', `${detail.staff_name} — ${formatVnDay(detail.work_date)}`);
      setDetail(null);
      await load();
    } catch (e) {
      toast.error('Không hủy được', errMsg(e, 'Ca đã bắt đầu nên không hủy được.'));
    } finally {
      setBusy(null);
    }
  };

  if (!facilityId) {
    return (
      <LayerCard className="p-8 text-center">
        <Text color="secondary">Chọn một chi nhánh để xem và xếp ca làm việc.</Text>
      </LayerCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-kumo-default">Ca làm việc</h1>
          <p className="text-xs text-kumo-secondary mt-0.5">
            Hệ thống tự gán việc bàn giao cho nhân viên có ca trùng giờ — xếp ca đủ để không bỏ
            trống ca bàn giao.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<UsersThree />} onClick={openAuto}>
            Tự động xếp ca
          </Button>
          <Button variant="primary" icon={<CalendarCheck />} onClick={openSchedule}>
            Xếp ca
          </Button>
        </div>
      </div>

      <LayerCard>
        <div className="flex flex-col gap-3 px-4 py-3 border-b border-kumo-line sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              icon={<CaretLeft />}
              aria-label="Tuần trước"
              onClick={() => setViewDate(addDays(viewDate, -7))}
            />
            <Button
              variant="ghost"
              size="sm"
              shape="square"
              icon={<CaretRight />}
              aria-label="Tuần sau"
              onClick={() => setViewDate(addDays(viewDate, 7))}
            />
            <Button variant="ghost" size="sm" onClick={() => setViewDate(vnToday())}>
              Tuần này
            </Button>
            <DateField
              className="w-40"
              aria-label="Chọn ngày để xem tuần"
              value={viewDate}
              onChange={(v) => v && setViewDate(v)}
            />
          </div>
          <Text size="sm" color="secondary">
            {formatVnDay(weekDays[0])} — {formatVnDay(weekDays[6])}
          </Text>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <CircleNotch className="w-6 h-6 animate-spin text-kumo-subtle" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[840px]">
              <thead>
                <tr className="border-b border-kumo-line">
                  <th className="text-left px-4 py-2.5 font-medium text-kumo-secondary w-36">Ca</th>
                  {weekDays.map((d) => (
                    <th
                      key={d}
                      className={`text-center px-2 py-2.5 font-medium ${
                        d === vnToday() ? 'text-kumo-brand' : 'text-kumo-secondary'
                      }`}
                    >
                      <div>{dayName(d)}</div>
                      <div className="text-[10px] font-normal">{formatVnDay(d)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarRows.map((tpl) => (
                  <tr key={tpl.id} className="border-b border-kumo-line last:border-0 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-kumo-default">
                        {tpl.name}
                        {tpl.retired ? (
                          <span className="ml-1 text-[10px] font-normal text-kumo-subtle">
                            (đã ngưng)
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-kumo-subtle">
                        {tpl.start_time} — {tpl.end_time}
                      </div>
                    </td>
                    {weekDays.map((d) => {
                      const cell = shifts.filter(
                        (s) => s.shift_template_id === tpl.id && s.work_date === d,
                      );
                      return (
                        <td key={d} className="px-2 py-2 align-top">
                          <div className="flex flex-col items-center gap-1">
                            {cell.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => openDetail(s)}
                                className="text-left"
                              >
                                <Badge
                                  variant={STATUS_DISPLAY[s.status].variant}
                                  className="max-w-full truncate"
                                >
                                  {s.staff_name ?? '—'}
                                </Badge>
                              </button>
                            ))}
                            {cell.length === 0 && <span className="text-kumo-subtle px-1">·</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {calendarRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-kumo-secondary">
                      Chưa có ca mẫu nào đang hoạt động.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-t border-kumo-line">
          {Object.entries(STATUS_DISPLAY).map(([status, display]) => (
            <span key={status} className="flex items-center gap-1.5">
              <Badge variant={display.variant}>{display.label}</Badge>
            </span>
          ))}
        </div>
      </LayerCard>

      {/* Schedule dialog */}
      <Dialog.Root open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <Dialog size="lg" className={`${DIALOG_SHELL} max-w-xl sm:w-[560px] w-full`}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <CalendarCheck className="w-5 h-5 text-kumo-brand" />
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Xếp ca cho nhân viên
              </Dialog.Title>
            </div>
            <Dialog.Close
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  shape="square"
                  icon={<X weight="bold" />}
                  aria-label="Đóng"
                />
              }
            />
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-kumo-default" htmlFor="shift-tpl">
                Ca làm việc
              </label>
              <Select
                className="w-full"
                aria-label="Ca làm việc"
                value={scheduleForm.templateId}
                onValueChange={(v) =>
                  v && setScheduleForm((p) => ({ ...p, templateId: String(v) }))
                }
                items={templates.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.start_time}–${t.end_time})`,
                }))}
                renderValue={(v) =>
                  templates.find((t) => t.id === v)
                    ? `${templates.find((t) => t.id === v)?.name} (${templates.find((t) => t.id === v)?.start_time}–${templates.find((t) => t.id === v)?.end_time})`
                    : 'Chọn ca'
                }
              />
            </div>

            <Combobox
              label="Nhân viên"
              description="Gõ tên hoặc số điện thoại, chọn để thêm vào danh sách xếp ca."
              items={staffOptions}
              value={null}
              inputValue={staffQuery}
              autoHighlight
              filter={(opt: StaffOption, query: string) =>
                staffMatches(opt.label, query) ||
                (opt.phone ? staffMatches(opt.phone, query) : false)
              }
              onInputValueChange={(v: string, details: { isItemPress?: boolean }) => {
                if (!details.isItemPress) setStaffQuery(v);
              }}
              onValueChange={(opt: StaffOption | null) => {
                if (!opt) return;
                setScheduleForm((p) =>
                  p.staffIds.includes(opt.value)
                    ? p
                    : { ...p, staffIds: [...p.staffIds, opt.value] },
                );
                setStaffQuery('');
              }}
            >
              <Combobox.TriggerInput
                placeholder="Tìm tên hoặc số điện thoại…"
                clearLabel="Xóa"
                showOptionsLabel="Xem danh sách nhân viên"
              />
              <Combobox.Content>
                <Combobox.Empty>
                  {staff.length === 0
                    ? 'Chưa có nhân viên nào trong chi nhánh.'
                    : staffOptions.length === 0
                      ? 'Đã chọn hết nhân viên.'
                      : 'Không tìm thấy nhân viên.'}
                </Combobox.Empty>
                <Combobox.List>
                  {(opt: StaffOption) => (
                    <Combobox.Item key={opt.value} value={opt}>
                      <span className="min-w-0">
                        <span className="block truncate">{opt.label}</span>
                        {opt.phone && (
                          <span className="block truncate text-xs text-kumo-secondary">
                            {opt.phone}
                          </span>
                        )}
                      </span>
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Content>
            </Combobox>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-kumo-default">
                  Đã chọn ({scheduleForm.staffIds.length})
                </span>
                <div className="flex items-center gap-1">
                  {staffOptions.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setScheduleForm((p) => ({
                          ...p,
                          staffIds: staff.map((m) => m.id),
                        }))
                      }
                    >
                      Chọn tất cả
                    </Button>
                  )}
                  {scheduleForm.staffIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setScheduleForm((p) => ({ ...p, staffIds: [] }))}
                    >
                      Bỏ chọn hết
                    </Button>
                  )}
                </div>
              </div>
              {selectedStaff.length === 0 ? (
                <div className="rounded-lg px-3 py-3 text-center text-xs text-kumo-secondary ring ring-kumo-line">
                  Chưa chọn nhân viên nào — tìm theo tên hoặc số điện thoại ở ô trên.
                </div>
              ) : (
                <ul className="max-h-44 overflow-y-auto rounded-lg ring ring-kumo-line divide-y divide-kumo-line">
                  {selectedStaff.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-kumo-default">
                          {m.fullName}
                        </span>
                        {m.phone && (
                          <span className="block truncate text-xs text-kumo-secondary">
                            {m.phone}
                          </span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        shape="square"
                        icon={<X weight="bold" />}
                        aria-label={`Bỏ chọn ${m.fullName}`}
                        onClick={() =>
                          setScheduleForm((p) => ({
                            ...p,
                            staffIds: p.staffIds.filter((id) => id !== m.id),
                          }))
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <DateField
                label="Từ ngày"
                value={scheduleForm.from}
                onChange={(v) => setScheduleForm((p) => ({ ...p, from: v }))}
              />
              <DateField
                label="Đến ngày"
                value={scheduleForm.to}
                onChange={(v) => setScheduleForm((p) => ({ ...p, to: v }))}
              />
            </div>

            <Textarea
              className="w-full"
              placeholder="Ghi chú cho các ca này (tùy chọn)"
              value={scheduleForm.note}
              onChange={(e) => setScheduleForm((p) => ({ ...p, note: e.target.value }))}
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setScheduleOpen(false)}
              disabled={busy === 'schedule'}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={submitSchedule}
              disabled={busy === 'schedule'}
              loading={busy === 'schedule'}
            >
              Xếp ca
            </Button>
          </DialogFooter>
        </Dialog>
      </Dialog.Root>

      {/* Auto-schedule dialog */}
      <Dialog.Root open={autoOpen} onOpenChange={setAutoOpen}>
        <Dialog size="lg" className={`${DIALOG_SHELL} max-w-xl sm:w-[560px] w-full`}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <UsersThree className="w-5 h-5 text-kumo-brand" />
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Tự động xếp ca tuần này
              </Dialog.Title>
            </div>
            <Dialog.Close
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  shape="square"
                  icon={<X weight="bold" />}
                  aria-label="Đóng"
                />
              }
            />
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Text size="sm" color="secondary">
              Nhập số nhân viên cần mỗi ca, từ {formatVnDay(weekDays[0])} đến{' '}
              {formatVnDay(weekDays[6])}. Hệ thống chia đều cho nhân viên của chi nhánh.
            </Text>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((t) => (
                <Input
                  key={t.id}
                  label={`${t.name} (${t.start_time}–${t.end_time})`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={String(autoHeadcount[t.id] ?? 0)}
                  onChange={(e) =>
                    setAutoHeadcount((p) => ({
                      ...p,
                      [t.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                />
              ))}
            </div>

            {preview && (
              <div className="space-y-2">
                <Text size="sm">
                  Xem trước: {preview.planned.length} ca sẽ tạo
                  {preview.unfilled.length > 0 &&
                    ` — thiếu ${preview.unfilled.reduce((n, u) => n + u.missing, 0)} chỗ`}
                </Text>
                <div className="max-h-56 overflow-y-auto rounded-lg ring ring-kumo-line">
                  <Table>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Ngày</Table.Head>
                        <Table.Head>Ca</Table.Head>
                        <Table.Head>Nhân viên</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {preview.planned.map((p, i) => (
                        <Table.Row key={`${p.staff_id}-${p.work_date}-${p.shift_template_id}-${i}`}>
                          <Table.Cell>{formatVnDay(p.work_date)}</Table.Cell>
                          <Table.Cell>{p.shift_template_name}</Table.Cell>
                          <Table.Cell>{p.staff_name}</Table.Cell>
                        </Table.Row>
                      ))}
                      {preview.unfilled.map((u) => (
                        <Table.Row key={`${u.work_date}-${u.shift_template_id}-missing`}>
                          <Table.Cell>{formatVnDay(u.work_date)}</Table.Cell>
                          <Table.Cell>{u.shift_template_code}</Table.Cell>
                          <Table.Cell>
                            <Badge variant="warning">Thiếu {u.missing} người</Badge>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                      {preview.planned.length === 0 && preview.unfilled.length === 0 && (
                        <Table.Row>
                          <Table.Cell colSpan={3} className="text-center text-kumo-secondary">
                            Không có ca nào cần xếp thêm.
                          </Table.Cell>
                        </Table.Row>
                      )}
                    </Table.Body>
                  </Table>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setAutoOpen(false)}
              disabled={busy === 'auto'}
            >
              Đóng
            </Button>
            {!preview ? (
              <Button
                variant="secondary"
                onClick={() => runAuto(true)}
                disabled={busy === 'auto'}
                loading={busy === 'auto'}
              >
                Xem trước
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => runAuto(false)}
                disabled={busy === 'auto' || preview.planned.length === 0}
                loading={busy === 'auto'}
              >
                Lưu {preview.planned.length} ca
              </Button>
            )}
          </DialogFooter>
        </Dialog>
      </Dialog.Root>

      {/* Shift detail dialog */}
      <Dialog.Root open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <Dialog size="lg" className={`${DIALOG_SHELL} max-w-md sm:w-[440px] w-full`}>
          <DialogHeader>
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              Chi tiết ca
            </Dialog.Title>
            <Dialog.Close
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  shape="square"
                  icon={<X weight="bold" />}
                  aria-label="Đóng"
                />
              }
            />
          </DialogHeader>
          <DialogBody className="space-y-4">
            {detail && (
              <>
                <div className="p-4 bg-kumo-control rounded-lg ring ring-kumo-line space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-kumo-default">
                      {detail.staff_name}
                    </span>
                    <Badge variant={STATUS_DISPLAY[detail.status].variant}>
                      {STATUS_DISPLAY[detail.status].label}
                    </Badge>
                  </div>
                  <div className="text-kumo-secondary">
                    {detail.shift_template_name} · {dayName(detail.work_date)}{' '}
                    {formatVnDay(detail.work_date)} · {timeOf(detail.start_at)}–
                    {timeOf(detail.end_at)}
                  </div>
                  {detail.check_in_at && (
                    <div className="text-kumo-secondary">
                      Chấm công vào {timeOf(detail.check_in_at)}
                      {detail.check_out_at && ` · Chấm công ra ${timeOf(detail.check_out_at)}`}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-xs font-medium text-kumo-default"
                    htmlFor="shift-note"
                  >
                    Ghi chú
                  </label>
                  <Textarea
                    placeholder="Ghi chú ca làm việc"
                    value={detailNote}
                    onChange={(e) => setDetailNote(e.target.value)}
                  />
                </div>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            {detail?.status === 'SCHEDULED' && (
              <Button
                variant="secondary-destructive"
                onClick={cancelShift}
                disabled={busy !== null}
                loading={busy === 'cancel'}
              >
                Hủy ca
              </Button>
            )}
            <Button
              variant="primary"
              onClick={saveNote}
              disabled={busy !== null}
              loading={busy === 'save'}
            >
              Lưu ghi chú
            </Button>
          </DialogFooter>
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
