import { Badge, Button, Empty, LayerCard, Table, Text } from '@cloudflare/kumo';
import type React from 'react';
import { useState } from 'react';
import type { UnitChangeRequestRecord } from '../../../lib/api';
import { formatVnDay, vnDay, vnTimeOfDay } from '../../../lib/vn-day';
import { ApproveChangeRequestDialog } from './ApproveChangeRequestDialog';

type BadgeVariant = 'success' | 'primary' | 'error' | 'warning' | 'neutral';

const REQUEST_STATUS_LABEL: Record<
  UnitChangeRequestRecord['status'],
  { label: string; variant: BadgeVariant }
> = {
  REQUESTED: { label: 'Chờ duyệt', variant: 'warning' },
  AWAITING_PAYMENT: { label: 'Chờ thanh toán bù cọc', variant: 'warning' },
  AWAITING_HANDOVER: { label: 'Chờ bàn giao', variant: 'primary' },
  AWAITING_FINAL_APPROVAL: { label: 'Chờ chốt cuối', variant: 'warning' },
  PROPOSED: { label: 'Đề xuất', variant: 'primary' },
  APPROVED: { label: 'Đã duyệt', variant: 'success' },
  TRANSITIONING: { label: 'Đang chuyển', variant: 'primary' },
  COMPLETED: { label: 'Hoàn tất', variant: 'success' },
  REJECTED: { label: 'Từ chối', variant: 'error' },
  CANCELLED: { label: 'Đã hủy', variant: 'neutral' },
};

/** dd/mm/yyyy · HH:mm of the move, in Vietnam time. */
const formatMoveAt = (iso: string | null) =>
  iso ? `${formatVnDay(vnDay(iso))} · ${vnTimeOfDay(iso)}` : '—';

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
  onFinalApprove: (id: string) => void;
  onCancel: (id: string) => void;
}

export const ChangeRequestsTable: React.FC<Props> = ({
  requests,
  busyId,
  onDecide,
  onFinalApprove,
  onCancel,
}) => {
  const [approving, setApproving] = useState<UnitChangeRequestRecord | null>(null);

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
              <Table.Head>Ngày giờ chuyển</Table.Head>
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
                  {formatMoveAt(req.move_at)}
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-kumo-subtle">{req.reason}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  <Badge variant={REQUEST_STATUS_LABEL[req.status].variant}>
                    {REQUEST_STATUS_LABEL[req.status].label}
                  </Badge>
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-right">
                  {req.status === 'REQUESTED' ? (
                    <div className="inline-flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => setApproving(req)}
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
                  ) : req.status === 'AWAITING_PAYMENT' || req.status === 'AWAITING_HANDOVER' ? (
                    <div className="inline-flex items-center gap-2">
                      <span className="text-xs text-kumo-subtle">
                        {req.status === 'AWAITING_PAYMENT' ? 'Chờ khách bù cọc' : 'Chờ bàn giao'}
                      </span>
                      <Button
                        variant="secondary-destructive"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => onCancel(req.id)}
                      >
                        Thu hồi
                      </Button>
                    </div>
                  ) : req.status === 'AWAITING_FINAL_APPROVAL' ? (
                    <div className="inline-flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() => onFinalApprove(req.id)}
                      >
                        Xác nhận hoàn tất
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

      <ApproveChangeRequestDialog
        request={approving}
        busy={busyId === approving?.id}
        onClose={() => setApproving(null)}
        onApprove={(moveAt, decisionNote) => {
          if (!approving) return;
          onDecide(approving.id, 'APPROVED', { moveAt, decisionNote });
          setApproving(null);
        }}
      />
    </div>
  );
};
