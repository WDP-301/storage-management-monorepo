import { Badge, Button, Empty, LayerCard, Table } from '@cloudflare/kumo';
import { PencilSimple, Power, Storefront } from '@phosphor-icons/react';
import React from 'react';
import type { FacilityRecord } from '../../lib/api';
import type { Province } from '../../types/warehouse';

export const FACILITY_STATUS_LABEL: Record<
  string,
  { label: string; variant: 'success' | 'neutral' | 'error' }
> = {
  ACTIVE: { label: 'Đang hoạt động', variant: 'success' },
  INACTIVE: { label: 'Ngừng hoạt động', variant: 'neutral' },
  MAINTENANCE: { label: 'Đang bảo trì', variant: 'error' },
};

interface Props {
  facilities: FacilityRecord[];
  provinces: Province[];
  hasFilters: boolean;
  busyId: string | null;
  onEdit: (f: FacilityRecord) => void;
  onDeactivate: (f: FacilityRecord) => void;
  onActivate: (f: FacilityRecord) => void;
}

export const FacilityTable: React.FC<Props> = ({
  facilities,
  provinces,
  hasFilters,
  busyId,
  onEdit,
  onDeactivate,
  onActivate,
}) => {
  const provinceName = (code: string | null) =>
    code ? (provinces.find((p) => p.code === code)?.name ?? code) : '—';

  return (
    <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Mã cơ sở</Table.Head>
            <Table.Head>Tên cơ sở</Table.Head>
            <Table.Head>Khu vực</Table.Head>
            <Table.Head>Số kho</Table.Head>
            <Table.Head>Trạng thái</Table.Head>
            <Table.Head className="text-right">Thao tác</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {facilities.length === 0 && (
            <Table.Row>
              <Table.Cell className="p-0" colSpan={6}>
                <Empty
                  size="sm"
                  icon={<Storefront className="w-8 h-8" />}
                  title="Không có cơ sở nào"
                  description={
                    hasFilters
                      ? 'Không có cơ sở nào khớp bộ lọc hiện tại.'
                      : 'Chưa có cơ sở nào. Hãy thêm cơ sở đầu tiên.'
                  }
                />
              </Table.Cell>
            </Table.Row>
          )}
          {facilities.map((f) => {
            const status = FACILITY_STATUS_LABEL[f.status] ?? {
              label: f.status,
              variant: 'neutral' as const,
            };
            return (
              <Table.Row key={f.id}>
                <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                  {f.code}
                </Table.Cell>
                <Table.Cell className="font-medium text-kumo-default">{f.name}</Table.Cell>
                <Table.Cell className="text-kumo-subtle">{provinceName(f.provinceCode)}</Table.Cell>
                <Table.Cell className="whitespace-nowrap">{f.warehouseCount ?? 0} kho</Table.Cell>
                <Table.Cell className="whitespace-nowrap">
                  <Badge variant={status.variant}>{status.label}</Badge>
                </Table.Cell>
                <Table.Cell className="whitespace-nowrap text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<PencilSimple className="w-3.5 h-3.5" />}
                      aria-label={`Chỉnh sửa cơ sở ${f.code}`}
                      onClick={() => onEdit(f)}
                    >
                      Sửa
                    </Button>
                    {f.status === 'ACTIVE' ? (
                      <Button
                        variant="secondary-destructive"
                        size="sm"
                        icon={<Power className="w-3.5 h-3.5" />}
                        aria-label={`Ngừng hoạt động cơ sở ${f.code}`}
                        onClick={() => onDeactivate(f)}
                      >
                        Ngừng
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Power className="w-3.5 h-3.5" />}
                        aria-label={`Kích hoạt cơ sở ${f.code}`}
                        disabled={busyId === f.id}
                        onClick={() => onActivate(f)}
                      >
                        Kích hoạt
                      </Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </LayerCard>
  );
};
