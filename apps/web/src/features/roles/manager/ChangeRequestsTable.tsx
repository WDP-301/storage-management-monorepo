import { Badge, Button, Dialog, Empty, Input, LayerCard, Table, Text } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import React from 'react';
import { DateField } from '../../../components/DateField';
import {
  DIALOG_FORM,
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../../components/dialog-layout';
import type { UnitChangeRequestRecord } from '../../../lib/api';

type BadgeVariant = 'success' | 'primary' | 'error' | 'warning' | 'neutral';

const REQUEST_STATUS_LABEL: Record<
  UnitChangeRequestRecord['status'],
  { label: string; variant: BadgeVariant }
> = {
  REQUESTED: { label: 'Chờ duyệt', variant: 'warning' },
  PROPOSED: { label: 'Đề xuất', variant: 'primary' },
  APPROVED: { label: 'Đã duyệt', variant: 'success' },
  TRANSITIONING: { label: 'Đang chuyển', variant: 'primary' },
  COMPLETED: { label: 'Hoàn tất', variant: 'success' },
  REJECTED: { label: 'Từ chối', variant: 'error' },
  CANCELLED: { label: 'Đã hủy', variant: 'neutral' },
};

const formatDate = (iso: string | Date | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

const toDateInputValue = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

const isCrossFacility = (r: UnitChangeRequestRecord) =>
  r.old_unit?.facility_id && r.new_unit?.facility_id
    ? r.old_unit.facility_id !== r.new_unit.facility_id
    : false;

interface Props {
  requests: UnitChangeRequestRecord[];
  busyId: string | null;
  onDecide: (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    options?: { moveAt?: string; decisionNote?: string },
  ) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
}

export const ChangeRequestsTable: React.FC<Props> = ({
  requests,
  busyId,
  onDecide,
  onStart,
  onComplete,
  onCancel,
}) => {
  const [approving, setApproving] = React.useState<UnitChangeRequestRecord | null>(null);
  const [moveDay, setMoveDay] = React.useState('');
  const [note, setNote] = React.useState('');

  const openApprove = (r: UnitChangeRequestRecord) => {
    setMoveDay(toDateInputValue(r.move_at));
    setNote('');
    setApproving(r);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-1">
        <Text as="h3" variant="heading">
          Yêu cầu đổi kho từ khách hàng
        </Text>
        <Text variant="secondary">
          Duyệt để giữ chỗ kho đích, theo dõi ngày chuyển và xác nhận khi bàn giao xong.
        </Text>
      </div>

      <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Khách hàng</Table.Head>
              <Table.Head>Kho hiện tại</Table.Head>
              <Table.Head>Kho muốn chuyển đến</Table.Head>
              <Table.Head>Chênh lệch</Table.Head>
              <Table.Head>Ngày chuyển</Table.Head>
              <Table.Head>Lý do chuyển</Table.Head>
              <Table.Head>Trạng thái</Table.Head>
              <Table.Head className="text-right">Thao tác</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {requests.length === 0 && (
              <Table.Row>
                <Table.Cell className="p-0" colSpan={8}>
                  <Empty
                    size="sm"
                    title="Chưa có yêu cầu nào"
                    description="Chưa có yêu cầu đổi kho nào."
                  />
                </Table.Cell>
              </Table.Row>
            )}
            {requests.map((req) => (
              <Table.Row key={req.id}>
                <Table.Cell className="whitespace-nowrap font-medium text-kumo-default">
                  {req.requester?.full_name ?? '—'}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap font-mono text-xs">
                  {req.old_unit?.code ?? '—'}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap font-mono text-xs text-kumo-brand font-semibold">
                  {req.new_unit?.code ?? '—'}
                  {isCrossFacility(req) ? (
                    <Badge variant="warning" className="ml-2">
                      Khác cơ sở
                    </Badge>
                  ) : null}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                  <div className="grid">
                    {Number(req.rent_difference) === 0 ? (
                      <span>—</span>
                    ) : (
                      <span>
                        {`${Number(req.rent_difference) > 0 ? '+' : ''}${Number(
                          req.rent_difference,
                        ).toLocaleString('vi-VN')} đ/tháng`}
                      </span>
                    )}
                    {Number(req.deposit_difference) > 0 ? (
                      <span className="text-xs text-kumo-warning">
                        Bù cọc {Number(req.deposit_difference).toLocaleString('vi-VN')} đ
                      </span>
                    ) : null}
                  </div>
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                  {formatDate(req.move_at)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-kumo-subtle">{req.reason}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  <Badge variant={REQUEST_STATUS_LABEL[req.status].variant}>
                    {REQUEST_STATUS_LABEL[req.status].label}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-right">
                  {req.status === 'REQUESTED' || req.status === 'PROPOSED' ? (
                    <div className="inline-flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => openApprove(req)}
                      >
                        Duyệt
                      </Button>
                      <Button
                        variant="secondary-destructive"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => onDecide(req.id, 'REJECTED')}
                      >
                        Từ chối
                      </Button>
                    </div>
                  ) : req.status === 'APPROVED' ? (
                    <div className="inline-flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => onStart(req.id)}
                      >
                        Bắt đầu chuyển
                      </Button>
                      <Button
                        variant="secondary-destructive"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => onCancel(req.id)}
                      >
                        Thu hồi
                      </Button>
                    </div>
                  ) : req.status === 'TRANSITIONING' ? (
                    <div className="inline-flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => onComplete(req.id)}
                      >
                        Xác nhận xong
                      </Button>
                      <Button
                        variant="secondary-destructive"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => onCancel(req.id)}
                      >
                        Thu hồi
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-kumo-subtle">Đã xử lý</span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>

      <Dialog.Root open={approving !== null} onOpenChange={(next) => !next && setApproving(null)}>
        <Dialog size="lg" className={`${DIALOG_SHELL} max-w-lg w-full`}>
          <form
            className={DIALOG_FORM}
            onSubmit={(e) => {
              e.preventDefault();
              if (!approving || !moveDay) return;
              onDecide(approving.id, 'APPROVED', {
                moveAt: `${moveDay}T12:00:00.000Z`,
                decisionNote: note.trim() || undefined,
              });
              setApproving(null);
            }}
          >
            <DialogHeader>
              <Dialog.Title className="text-base font-semibold text-kumo-default">
                Duyệt yêu cầu đổi kho
              </Dialog.Title>
              <Dialog.Close
                render={(props) => (
                  <button
                    type="button"
                    {...props}
                    className="p-1.5 rounded-md text-kumo-subtle hover:text-kumo-default hover:bg-kumo-control cursor-pointer"
                    aria-label="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              />
            </DialogHeader>
            <DialogBody>
              {approving ? (
                <Text variant="secondary" size="sm">
                  Kho {approving.new_unit?.code ?? '—'} sẽ được giữ chỗ cho khách ngay khi duyệt.
                  {Number(approving.deposit_difference) > 0
                    ? ` Hệ thống sẽ xuất hoá đơn bù cọc ${Number(
                        approving.deposit_difference,
                      ).toLocaleString('vi-VN')} đ.`
                    : ''}
                </Text>
              ) : null}
              <DateField label="Ngày chuyển đồ" required value={moveDay} onChange={setMoveDay} />
              <Input
                label="Ghi chú (không bắt buộc)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </DialogBody>
            <DialogFooter>
              <Button
                variant="primary"
                type="submit"
                disabled={!moveDay || busyId === approving?.id}
              >
                Duyệt và giữ chỗ
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
