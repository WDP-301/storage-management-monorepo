import { Badge, Button, Dialog } from '@cloudflare/kumo';
import { ShelfReceiptStatus, UserRole } from '@storage/types';
import type React from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { SignedFileGallery } from '../../components/SignedImageLightbox';
import { useAuth } from '../../context/AuthContext';
import { hasAllowedRole } from '../../lib/roles';
import { ShelfStorageApi } from '../../lib/shelf-storage-api';
import { formatDateTime } from '../inspections/inspection-display';
import { ReceiptDisputePanel } from './ReceiptDisputePanel';
import { ShelfReceiptVoidForm } from './ShelfReceiptVoidForm';
import { RECEIPT_TYPE_LABEL } from './shelf-records-display';
import { useShelfLoad } from './use-shelf-load';

const VOID_ROLES = [UserRole.FACILITY_MANAGER, UserRole.OPERATIONS_MANAGER, UserRole.ADMIN];

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-3 text-sm">
    <dt className="text-kumo-subtle shrink-0">{label}</dt>
    <dd className="text-kumo-default text-right break-words">{children}</dd>
  </div>
);

interface Props {
  receiptId: string | null;
  onClose: () => void;
  /** Called after a void so lists behind the dialog can refresh. */
  onChanged?: () => void;
}

export const ShelfReceiptDetailDialog: React.FC<Props> = ({ receiptId, onClose, onChanged }) => {
  const { user } = useAuth();
  // Fresh on every open: stock-affecting state (void, dispute) must not come from a cached list row.
  const {
    data: receipt,
    loading,
    error,
    reload,
  } = useShelfLoad(
    () => (receiptId ? ShelfStorageApi.receipt(receiptId) : Promise.resolve(null)),
    receiptId ?? 'closed',
  );
  const canVoid = hasAllowedRole(user?.roles, VOID_ROLES);
  const shown = receipt && receipt.id === receiptId ? receipt : null;

  return (
    <Dialog.Root open={Boolean(receiptId)} onOpenChange={(open) => !open && onClose()}>
      <Dialog size="xl" className={`${DIALOG_SHELL} max-w-2xl sm:w-[640px] w-full`}>
        <DialogHeader>
          <Dialog.Title className="text-base font-semibold text-kumo-default">
            Phiếu {shown ? `${RECEIPT_TYPE_LABEL[shown.type].toLowerCase()} ${shown.code}` : ''}
          </Dialog.Title>
          {shown?.status === ShelfReceiptStatus.VOIDED && <Badge variant="error">Đã hủy</Badge>}
        </DialogHeader>
        <DialogBody>
          {loading && !shown && <p className="text-sm text-kumo-subtle">Đang tải...</p>}
          {error && (
            <div
              role="alert"
              className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm"
            >
              {error}
            </div>
          )}
          {shown && (
            <>
              {shown.openDisputeTicket && <ReceiptDisputePanel ticket={shown.openDisputeTicket} />}
              <dl className="space-y-1.5">
                <Row label="Thời gian">{formatDateTime(String(shown.createdAt))}</Row>
                <Row label="Người thực hiện">{shown.performedBy?.fullName ?? '—'}</Row>
                <Row label="Khách hàng">
                  {shown.customer.fullName ?? '—'} {shown.customer.phone ?? ''}
                </Row>
                <Row label="Hợp đồng">{shown.contractNo}</Row>
                <Row label="Kệ / kho">
                  {shown.shelf.code} · {shown.warehouse.name} ({shown.facility.name})
                </Row>
                {shown.recovered && <Row label="Hình thức">Thu hồi đồ (không quét mã)</Row>}
              </dl>
              <section className="space-y-1.5">
                <span className="text-xs font-semibold text-kumo-default block">Danh sách đồ</span>
                <ul className="text-sm space-y-1">
                  {shown.lines.map((line) => (
                    <li key={line.itemId} className="flex justify-between">
                      <span>{line.name}</span>
                      <span className="font-semibold">×{line.quantity}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {shown.note && (
                <p className="text-sm text-kumo-default whitespace-pre-wrap">
                  <span className="text-kumo-subtle">Ghi chú: </span>
                  {shown.note}
                </p>
              )}
              {shown.photos.length > 0 && (
                <section className="space-y-1.5">
                  <span className="text-xs font-semibold text-kumo-default block">
                    Ảnh ({shown.photos.length})
                  </span>
                  <SignedFileGallery files={shown.photos} />
                </section>
              )}
              {shown.void && (
                <section className="p-4 rounded-lg bg-kumo-danger-tint text-sm space-y-1">
                  <p className="font-semibold text-kumo-danger">Phiếu đã bị hủy</p>
                  <p>
                    {formatDateTime(String(shown.void.at))} · {shown.void.by?.fullName ?? '—'}
                  </p>
                  <p className="whitespace-pre-wrap">Lý do: {shown.void.reason}</p>
                </section>
              )}
              {canVoid && shown.status === ShelfReceiptStatus.ACTIVE && (
                <ShelfReceiptVoidForm
                  key={shown.id}
                  receipt={shown}
                  onVoided={() => {
                    reload();
                    onChanged?.();
                  }}
                />
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
        </DialogFooter>
      </Dialog>
    </Dialog.Root>
  );
};
