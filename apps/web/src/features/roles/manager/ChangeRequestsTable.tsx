import { Badge, Button, Empty, LayerCard, Table, Text } from '@cloudflare/kumo';
import React from 'react';
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

const formatDate = (iso: string | Date) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

interface Props {
  requests: UnitChangeRequestRecord[];
  busyId: string | null;
  onDecide: (id: string, decision: 'APPROVED' | 'REJECTED') => void;
}

export const ChangeRequestsTable: React.FC<Props> = ({ requests, busyId, onDecide }) => (
  <div className="space-y-3">
    <div className="grid gap-1">
      <Text as="h3" variant="heading">
        Yêu cầu đổi kho từ khách hàng
      </Text>
      <Text variant="secondary">
        Phê duyệt hoặc từ chối đơn chuyển sang kho khác của người thuê.
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
            <Table.Head>Lý do chuyển</Table.Head>
            <Table.Head>Ngày gửi</Table.Head>
            <Table.Head>Trạng thái</Table.Head>
            <Table.Head className="text-right">Quyết định</Table.Head>
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
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                {req.rent_difference === 0
                  ? '—'
                  : `${req.rent_difference > 0 ? '+' : ''}${Number(req.rent_difference).toLocaleString('vi-VN')} đ`}
              </Table.Cell>
              <Table.Cell className="whitespace-nowrap text-kumo-subtle">{req.reason}</Table.Cell>
              <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                {formatDate(req.created_at)}
              </Table.Cell>
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
                      onClick={() => onDecide(req.id, 'APPROVED')}
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
                ) : (
                  <span className="text-xs text-kumo-subtle">Đã xử lý</span>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </LayerCard>
  </div>
);
