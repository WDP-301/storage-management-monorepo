import { Badge, Button, Dialog, Text } from '@cloudflare/kumo';
import {
  FileText,
  PencilSimple,
  Trash,
  UploadSimple,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { SignedFileLink } from '../../components/SignedFile';
import { useAuth } from '../../context/AuthContext';
import { ContractsApi, UploadsApi } from '../../lib/api';
import type { ContractRecord } from '../../types/contract';
import { formatDateTime, formatDay } from '../inspections/inspection-display';
import { formatVnd } from '../warehouses/warehouse-display';
import { ContractEditDialog } from './ContractEditDialog';
import {
  CONTRACT_KIND_LABEL,
  CONTRACT_STATUS_LABEL,
  evidenceFileKey,
  fileNameOf,
  HANDOVER_STATE_LABEL,
  handoverState,
  plannedEnd,
  shortContractNo,
} from './contract-display';

interface Props {
  contract: ContractRecord | null;
  onClose: () => void;
  /** Called after any change so the page reloads the list. */
  onChanged: () => void;
}

type Busy = 'cancel' | 'remove' | 'upload' | null;
type Confirm = 'cancel' | 'remove' | null;

export const ContractDetailDialog: React.FC<Props> = ({ contract, onClose, onChanged }) => {
  const { activeRole } = useAuth();
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const contractId = contract?.id;
  // The contract on screen; an action that finishes after another one opened must not touch it.
  const shownId = useRef(contractId);
  useEffect(() => {
    shownId.current = contractId;
    setBusy(null);
    setConfirm(null);
    setEditing(false);
    setError(null);
  }, [contractId]);

  if (!contract) return null;
  // Edits and deletes can strand a unit, so they stay with system-wide roles.
  const canManage = activeRole === UserRole.ADMIN || activeRole === UserRole.OPERATIONS_MANAGER;
  const canCancel = canManage || activeRole === UserRole.FACILITY_MANAGER;
  const code = shortContractNo(contract.contract_no);
  const status = CONTRACT_STATUS_LABEL[contract.status];
  const editable = contract.status === 'DRAFT' || contract.status === 'ACTIVE';
  const removable = contract.status === 'ENDED' || contract.status === 'CANCELLED';

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<unknown>) => {
    const id = contract.id;
    setBusy(kind);
    setError(null);
    try {
      await action();
      onChanged();
      if (kind === 'remove' && shownId.current === id) onClose();
    } catch (err) {
      if (shownId.current === id) {
        setError(err instanceof Error ? err.message : 'Thao tác thất bại.');
      }
    } finally {
      if (shownId.current === id) {
        setBusy(null);
        setConfirm(null);
      }
    }
  };

  // Shown in place of the detail, so two modal dialogs never compete for focus.
  if (editing) {
    return (
      <ContractEditDialog
        contract={contract}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  const uploadEvidence = (file: File) =>
    run('upload', async () => {
      const { publicUrl } = await UploadsApi.upload(file);
      await ContractsApi.setEvidence(contract.id, publicUrl);
    });

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
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-kumo-default">
                  Hợp đồng {code}
                </Dialog.Title>
                <Text variant="secondary">{contract.facility?.name ?? ''}</Text>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              <button
                type="button"
                aria-label="Đóng"
                onClick={onClose}
                className="p-1.5 rounded-md text-kumo-subtle hover:bg-kumo-control cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Fact label="Khách hàng" value={contract.customer.full_name ?? 'Khách hàng'} />
            <Fact label="Điện thoại" value={contract.customer.phone ?? '—'} />
            <Fact label="Email" value={contract.customer.email ?? '—'} />
            <Fact label="Loại hợp đồng" value={CONTRACT_KIND_LABEL[contract.kind]} />
            <Fact
              label="Kho"
              value={contract.unit ? `${contract.unit.code} · ${contract.unit.name}` : '—'}
            />
            <Fact label="Địa chỉ kho" value={contract.unit?.address_line ?? '—'} />
            <Fact label="Hiệu lực từ" value={formatDay(contract.effective_at)} />
            <Fact
              label="Thời hạn"
              value={`${contract.months} tháng · đến ${formatDay(plannedEnd(contract))}`}
            />
            <Fact label="Giá thuê / tháng" value={formatVnd(contract.monthly_price)} />
            <Fact label="Tiền cọc" value={formatVnd(contract.deposit)} />
            <Fact label="Ngày ký" value={formatDay(contract.signed_at)} />
            <Fact label="Ngày kết thúc" value={formatDay(contract.ended_at)} />
            <Fact label="Mã đầy đủ" value={contract.contract_no} mono />
            <Fact label="Tạo lúc" value={formatDateTime(contract.created_at)} />
          </dl>

          <section className="space-y-1.5">
            <span className="text-xs font-semibold text-kumo-default block">Bàn giao kho</span>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm p-3 bg-kumo-control rounded-lg">
              <Fact label="Nhận kho" value={HANDOVER_STATE_LABEL[handoverState(contract)]} />
              <Fact label="Nhân viên" value={contract.handover?.inspector_name ?? '—'} />
              <Fact label="Ngày hẹn" value={formatDay(contract.handover?.scheduled_at ?? null)} />
              <Fact
                label="Trả kho"
                value={
                  contract.return
                    ? contract.return.finalized_at
                      ? `Đã trả ${formatDay(contract.return.finalized_at)}`
                      : `Hẹn trả ${formatDay(contract.return.scheduled_at)}`
                    : '—'
                }
              />
            </dl>
          </section>

          <section className="space-y-1.5">
            <span className="text-xs font-semibold text-kumo-default block">File hợp đồng</span>
            {contract.evidence ? (
              <SignedFileLink
                file={{
                  name: fileNameOf(contract.evidence),
                  fileKey: evidenceFileKey(contract.evidence) ?? undefined,
                  url: contract.evidence,
                }}
              />
            ) : (
              <p className="text-sm text-kumo-subtle">Chưa có file hợp đồng.</p>
            )}
            {canManage && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="application/pdf,image/*"
                  aria-label="Chọn file hợp đồng"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void uploadEvidence(file);
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<UploadSimple className="w-3.5 h-3.5" />}
                  loading={busy === 'upload'}
                  disabled={busy !== null}
                  onClick={() => fileInput.current?.click()}
                >
                  {contract.evidence ? 'Thay file' : 'Tải file lên'}
                </Button>
              </>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex gap-2"
            >
              <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {confirm ? (
            <div className="p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
              <p className="text-kumo-default">
                {confirm === 'cancel'
                  ? 'Hủy hợp đồng này? Kho sẽ trở về trạng thái trống để cho thuê lại. Không hoàn tác được.'
                  : 'Xóa hợp đồng này khỏi danh sách? Không hoàn tác được.'}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setConfirm(null)}>
                  Quay lại
                </Button>
                <Button
                  variant="primary"
                  loading={busy === confirm}
                  onClick={() =>
                    confirm === 'cancel'
                      ? run('cancel', () => ContractsApi.cancel(contract.id))
                      : run('remove', () => ContractsApi.remove(contract.id))
                  }
                >
                  {confirm === 'cancel' ? 'Xác nhận hủy hợp đồng' : 'Xác nhận xóa'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-kumo-line">
              {canCancel && contract.status === 'DRAFT' && (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => setConfirm('cancel')}
                >
                  Hủy hợp đồng
                </Button>
              )}
              {canManage && removable && (
                <Button
                  variant="secondary"
                  icon={<Trash className="w-3.5 h-3.5" />}
                  disabled={busy !== null}
                  onClick={() => setConfirm('remove')}
                >
                  Xóa
                </Button>
              )}
              {canManage && editable && (
                <Button
                  variant="primary"
                  icon={<PencilSimple className="w-3.5 h-3.5" />}
                  disabled={busy !== null}
                  onClick={() => setEditing(true)}
                >
                  Sửa hợp đồng
                </Button>
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
