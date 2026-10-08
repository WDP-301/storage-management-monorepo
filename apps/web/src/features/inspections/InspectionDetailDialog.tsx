import { Badge, Button, Dialog, Text } from '@cloudflare/kumo';
import { ClipboardText, WarningCircle, X } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { SignedImageThumb } from '../../components/SignedFile';
import { FacilitiesApi, InspectionsApi } from '../../lib/api';
import type { FacilityStaffMember, InspectionRecord } from '../../types/inspection';
import {
  customerName,
  customerPhone,
  facilityId,
  finalizeConsequence,
  formatDateTime,
  formatDay,
  INSPECTION_KIND_LABEL,
  toDamages,
  toEvidence,
  unitCode,
} from './inspection-display';

interface Props {
  inspection: InspectionRecord | null;
  onClose: () => void;
  /** Called after an assign or finalize so the page can reload. */
  onChanged: () => void;
}

export const InspectionDetailDialog: React.FC<Props> = ({ inspection, onClose, onChanged }) => {
  const [staff, setStaff] = useState<FacilityStaffMember[]>([]);
  const [staffId, setStaffId] = useState('');
  const [busy, setBusy] = useState<'assign' | 'finalize' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const facility = inspection ? facilityId(inspection) : null;
  useEffect(() => {
    setStaffId(inspection?.inspectedBy ?? '');
    setConfirming(false);
    setError(null);
    if (!facility || inspection?.finalizedAt) return;
    FacilitiesApi.listStaff(facility)
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [inspection, facility]);

  if (!inspection) return null;
  const done = Boolean(inspection.finalizedAt);
  const evidence = toEvidence(inspection.evidence);
  const damages = toDamages(inspection.damages);

  const run = async (kind: 'assign' | 'finalize', action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog
        size="xl"
        className="p-6 sm:p-7 max-w-2xl sm:w-[640px] w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between border-b border-kumo-line pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-kumo-fill flex items-center justify-center shrink-0">
                <ClipboardText className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-kumo-default">
                  Biên bản {INSPECTION_KIND_LABEL[inspection.type].toLowerCase()} ·{' '}
                  {unitCode(inspection)}
                </Dialog.Title>
                <Text variant="secondary">
                  {inspection.contract?.bookingItem?.storageUnit?.facility?.name ?? ''}
                </Text>
              </div>
            </div>
            <button
              type="button"
              aria-label="Đóng"
              onClick={onClose}
              className="p-1.5 rounded-md text-kumo-subtle hover:bg-kumo-control cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Fact label="Khách hàng" value={customerName(inspection)} />
            <Fact label="Điện thoại" value={customerPhone(inspection) ?? '—'} />
            <Fact label="Hợp đồng" value={inspection.contract?.contractNo ?? '—'} mono />
            <Fact label="Ngày hẹn" value={formatDay(inspection.scheduledAt)} />
            <Fact label="Phụ trách" value={inspection.inspector?.fullName ?? 'Chưa giao'} />
            <Fact label="Chốt lúc" value={done ? formatDateTime(inspection.finalizedAt) : '—'} />
          </dl>

          <section className="space-y-1.5">
            <span className="text-xs font-semibold text-kumo-default block">
              Ghi chú tình trạng
            </span>
            <p className="p-3 bg-kumo-control rounded-lg text-sm text-kumo-default whitespace-pre-wrap">
              {inspection.conditionNotes || 'Chưa có ghi chú.'}
            </p>
          </section>

          <section className="space-y-1.5">
            <span className="text-xs font-semibold text-kumo-default block">
              Ảnh hiện trạng ({evidence.length})
            </span>
            {evidence.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {evidence.map((file) => (
                  <SignedImageThumb key={file.fileKey} file={file} />
                ))}
              </div>
            ) : (
              <Text variant="secondary">Chưa có ảnh.</Text>
            )}
          </section>

          {damages.length > 0 && (
            <section className="space-y-2">
              <span className="text-xs font-semibold text-kumo-default block">
                Hư hỏng ({damages.length})
              </span>
              {damages.map((damage, index) => (
                <div
                  key={`${damage.description}-${index}`}
                  className="p-3 rounded-lg ring ring-kumo-line space-y-2"
                >
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-kumo-default">{damage.description}</span>
                    <Badge variant={damage.severity === 'MAJOR' ? 'error' : 'warning'}>
                      {damage.severity === 'MAJOR' ? 'Nghiêm trọng' : 'Nhẹ'}
                    </Badge>
                  </div>
                  {damage.evidence && damage.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {damage.evidence.map((file) => (
                        <SignedImageThumb key={file.fileKey} file={file} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {error && (
            <div
              role="alert"
              className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex gap-2"
            >
              <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {!done && (
            <div className="space-y-3 pt-3 border-t border-kumo-line">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  aria-label="Chọn nhân viên phụ trách"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="flex-1 h-9 px-3 text-sm bg-kumo-base border border-kumo-line rounded-lg"
                >
                  <option value="">
                    {staff.length > 0 ? '-- Chọn nhân viên --' : 'Cơ sở chưa có nhân viên'}
                  </option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName}
                      {member.phone ? ` · ${member.phone}` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={!staffId || staffId === inspection.inspectedBy || busy !== null}
                  loading={busy === 'assign'}
                  onClick={() => run('assign', () => InspectionsApi.assign(inspection.id, staffId))}
                >
                  {inspection.inspectedBy ? 'Đổi người phụ trách' : 'Giao nhân viên'}
                </Button>
              </div>

              {confirming ? (
                <div className="p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
                  <p className="text-kumo-default">
                    {finalizeConsequence(inspection)} Biên bản không sửa được sau khi chốt.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setConfirming(false)}>
                      Huỷ
                    </Button>
                    <Button
                      variant="primary"
                      loading={busy === 'finalize'}
                      onClick={() => run('finalize', () => InspectionsApi.finalize(inspection.id))}
                    >
                      Xác nhận chốt
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <Button
                    variant="primary"
                    disabled={!inspection.inspectedBy || busy !== null}
                    title={inspection.inspectedBy ? undefined : 'Giao nhân viên trước khi chốt'}
                    onClick={() => setConfirming(true)}
                  >
                    Chốt biên bản
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </Dialog.Root>
  );
};

const Fact: React.FC<{ label: string; value: string; mono?: boolean }> = ({
  label,
  value,
  mono,
}) => (
  <div className="min-w-0">
    <dt className="text-xs text-kumo-subtle">{label}</dt>
    <dd className={`text-kumo-default truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
  </div>
);
