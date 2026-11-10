import { Badge, Button, Dialog, Text } from '@cloudflare/kumo';
import { ArrowLeft, ClipboardText, WarningCircle, X } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DialogBody, DialogFooter, DialogHeader } from '../../components/dialog-layout';
import { SignedFileGallery } from '../../components/SignedImageLightbox';
import { StaffSelect } from '../../components/StaffSelect';
import { ContractsApi, FacilitiesApi, InspectionsApi } from '../../lib/api';
import type { FacilityStaffMember, InspectionRecord } from '../../types/inspection';
import { describeApiError } from '../contracts/settlement-display';
import { formatVnd } from '../warehouses/warehouse-display';
import { InspectionFinalizeConfirm } from './InspectionFinalizeConfirm';
import {
  customerName,
  customerPhone,
  facilityId,
  formatDateTime,
  formatDay,
  INSPECTION_KIND_LABEL,
  toDamages,
  toEvidence,
  unitCode,
} from './inspection-display';
import { ReturnRescheduleForm } from './ReturnRescheduleForm';

interface Props {
  inspection: InspectionRecord;
  onClose: () => void;
  /** Called after an assign or finalize so the page can reload. */
  onChanged: () => void;
  /** Opened from another view (a contract): shows a way back to it next to the title. */
  onBack?: () => void;
  /** What `onBack` returns to, e.g. "Hợp đồng CT-1A2B3C4D". */
  backLabel?: string;
}

/**
 * Header, body and footer of an inspection record, without the dialog around them, so it can be
 * its own dialog or a step inside the contract dialog.
 */
export const InspectionDetailView: React.FC<Props> = ({
  inspection,
  onClose,
  onChanged,
  onBack,
  backLabel,
}) => {
  const [staff, setStaff] = useState<FacilityStaffMember[]>([]);
  const [staffId, setStaffId] = useState('');
  const [busy, setBusy] = useState<'assign' | 'finalize' | 'cancel' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const facility = facilityId(inspection);
  useEffect(() => {
    setStaffId(inspection.inspectedBy ?? '');
    setConfirming(false);
    setConfirmingCancel(false);
    setError(null);
    if (!facility || inspection.finalizedAt) return;
    FacilitiesApi.listStaff(facility)
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [inspection, facility]);

  const done = Boolean(inspection.finalizedAt);
  const evidence = toEvidence(inspection.evidence);
  const damages = toDamages(inspection.damages);
  // Only a payload that lists documents and has none blocks; the API enforces the rule either way.
  const missingContractFiles =
    inspection.type === 'PRE_HANDOVER' &&
    Array.isArray(inspection.contract?.documents) &&
    toEvidence(inspection.contract?.documents).length === 0;

  const run = async (kind: 'assign' | 'finalize' | 'cancel', action: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(describeApiError(err, 'Thao tác thất bại.'));
    } finally {
      setBusy(null);
      setConfirming(false);
      setConfirmingCancel(false);
    }
  };

  return (
    <>
      <DialogHeader className={onBack ? 'flex-col items-stretch gap-2' : undefined}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-1.5 inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium text-kumo-brand hover:bg-kumo-control cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel ?? 'Quay lại'}
          </button>
        )}
        <div className="flex items-center justify-between gap-3">
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
      </DialogHeader>

      {/* Inside the contract dialog it keeps the contract's height, so stepping in and back
          does not resize the frame. */}
      <DialogBody className={onBack ? 'min-h-[60vh]' : undefined}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Fact label="Khách hàng" value={customerName(inspection)} />
          <Fact label="Điện thoại" value={customerPhone(inspection) ?? '—'} />
          <Fact label="Hợp đồng" value={inspection.contract?.contractNo ?? '—'} mono />
          <Fact label="Ngày hẹn" value={formatDay(inspection.scheduledAt)} />
          <Fact label="Phụ trách" value={inspection.inspector?.fullName ?? 'Chưa giao'} />
          <Fact label="Chốt lúc" value={done ? formatDateTime(inspection.finalizedAt) : '—'} />
        </dl>

        {inspection.requestNote && (
          <section className="space-y-1.5">
            <span className="text-xs font-semibold text-kumo-default block">Ghi chú của khách</span>
            <p className="p-3 bg-kumo-control rounded-lg text-sm text-kumo-default whitespace-pre-wrap">
              {inspection.requestNote}
            </p>
          </section>
        )}

        <section className="space-y-1.5">
          <span className="text-xs font-semibold text-kumo-default block">Ghi chú tình trạng</span>
          <p className="p-3 bg-kumo-control rounded-lg text-sm text-kumo-default whitespace-pre-wrap">
            {inspection.conditionNotes || 'Chưa có ghi chú.'}
          </p>
        </section>

        <section className="space-y-1.5">
          <span className="text-xs font-semibold text-kumo-default block">
            Ảnh hiện trạng ({evidence.length})
          </span>
          {evidence.length > 0 ? (
            <SignedFileGallery files={evidence} />
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
                {inspection.type === 'RETURN' && (
                  <p className="text-xs text-kumo-subtle">
                    {damage.proposedFee == null
                      ? 'Chưa có phí đề xuất'
                      : `Phí đề xuất: ${formatVnd(damage.proposedFee)}`}
                  </p>
                )}
                {damage.evidence && damage.evidence.length > 0 && (
                  <SignedFileGallery files={damage.evidence} />
                )}
              </div>
            ))}
          </section>
        )}

        {!done && (
          <div className="space-y-3">
            {inspection.type === 'RETURN' && (
              <ReturnRescheduleForm
                inspection={inspection}
                disabled={busy !== null}
                onSaved={onChanged}
              />
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <StaffSelect
                ariaLabel="Chọn nhân viên phụ trách"
                className="flex-1"
                staff={staff}
                value={staffId}
                onChange={setStaffId}
              />
              <Button
                variant="secondary"
                disabled={!staffId || staffId === inspection.inspectedBy || busy !== null}
                loading={busy === 'assign'}
                onClick={() => run('assign', () => InspectionsApi.assign(inspection.id, staffId))}
              >
                {inspection.inspectedBy ? 'Đổi người phụ trách' : 'Giao nhân viên'}
              </Button>
            </div>

            {missingContractFiles && (
              <p role="status" className="text-sm text-kumo-warning">
                Chưa có file hợp đồng đã ký — tải lên ở{' '}
                <Link to="/contracts" className="font-medium underline">
                  trang Hợp đồng
                </Link>{' '}
                trước khi chốt biên nhận.
              </p>
            )}
          </div>
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
      </DialogBody>

      {!done && (
        <DialogFooter className={confirming || confirmingCancel ? 'block' : undefined}>
          {confirming ? (
            <InspectionFinalizeConfirm
              inspection={inspection}
              busy={busy === 'finalize'}
              onCancel={() => setConfirming(false)}
              onConfirm={() => run('finalize', () => InspectionsApi.finalize(inspection.id))}
            />
          ) : confirmingCancel ? (
            <div className="p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
              <p className="text-kumo-default">
                Huỷ hợp đồng nháp này? Kho sẽ được trả về trạng thái trống để cho thuê lại. Không
                hoàn tác được.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>
                  Không huỷ
                </Button>
                <Button
                  variant="primary"
                  loading={busy === 'cancel'}
                  onClick={() =>
                    inspection.contract &&
                    run('cancel', () => ContractsApi.cancel(inspection.contract?.id ?? ''))
                  }
                >
                  Xác nhận huỷ hợp đồng
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              {inspection.type === 'PRE_HANDOVER' && inspection.contract?.status === 'DRAFT' && (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => setConfirmingCancel(true)}
                >
                  Khách không nhận kho
                </Button>
              )}
              <Button
                variant="primary"
                disabled={!inspection.inspectedBy || missingContractFiles || busy !== null}
                title={inspection.inspectedBy ? undefined : 'Giao nhân viên trước khi chốt'}
                onClick={() => setConfirming(true)}
              >
                Chốt biên bản
              </Button>
            </div>
          )}
        </DialogFooter>
      )}
    </>
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
