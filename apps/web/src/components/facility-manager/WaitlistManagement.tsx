import { Badge, Button, Dialog, Meter, Table, Text } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import { IStorageUnit, IWaitlistEntry, UnitStatus } from '@storage/types';
import React, { useState } from 'react';

interface WaitlistManagementProps {
  waitlist: IWaitlistEntry[];
  availableUnits: IStorageUnit[];
  onNotifyCustomer?: (waitlistId: string, unitCode: string) => void;
}

const STATUS_BADGE: Record<
  IWaitlistEntry['status'],
  { variant: 'warning' | 'primary' | 'neutral' | 'success'; label: string }
> = {
  WAITING: { variant: 'warning', label: 'Đang chờ' },
  OFFERED: { variant: 'primary', label: 'Đã gửi offer' },
  EXPIRED: { variant: 'neutral', label: 'Hết hạn' },
  CONVERTED: { variant: 'success', label: 'Đã chuyển HĐ' },
};

export const WaitlistManagement: React.FC<WaitlistManagementProps> = ({
  waitlist: initialWaitlist,
  availableUnits,
  onNotifyCustomer,
}) => {
  const [waitlist, setWaitlist] = useState<IWaitlistEntry[]>(initialWaitlist);
  const [assigningEntry, setAssigningEntry] = useState<IWaitlistEntry | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  const handleAssignUnit = () => {
    if (!assigningEntry || !selectedUnitId) return;
    const unit = availableUnits.find((u) => u.id === selectedUnitId);
    if (!unit) return;

    setWaitlist((prev) =>
      prev.map((entry) =>
        entry.id === assigningEntry.id ? { ...entry, status: 'OFFERED' } : entry,
      ),
    );
    onNotifyCustomer?.(assigningEntry.id, unit.code);
    alert(
      `Đã gán kho ${unit.code} và thông báo (SMS/Email) cho khách hàng ${assigningEntry.customerName}!`,
    );
    setAssigningEntry(null);
    setSelectedUnitId('');
  };

  const getMatchedUnits = (entry: IWaitlistEntry) =>
    availableUnits.filter(
      (u) => u.status === UnitStatus.AVAILABLE && u.category === entry.preferredCategory,
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Danh sách chờ (Waitlist)
          </Text>
          <Text variant="secondary" size="sm">
            Quản lý khách chờ nhận kho và độ phù hợp tự động (match score)
          </Text>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => alert('Mở form thêm khách vào waitlist')}
        >
          Thêm vào danh sách
        </Button>
      </div>

      <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Khách hàng</Table.Head>
                <Table.Head>Yêu cầu nhận kho</Table.Head>
                <Table.Head>Ngày mong muốn</Table.Head>
                <Table.Head>Match score</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Thao tác</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {waitlist.map((entry) => {
                const matchCount = getMatchedUnits(entry).length;
                return (
                  <Table.Row key={entry.id}>
                    <Table.Cell>
                      <div>
                        <p className="font-medium text-kumo-strong">{entry.customerName}</p>
                        <p className="text-xs text-kumo-subtle">
                          {entry.customerPhone} • ĐK: {entry.createdAt}
                        </p>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="font-medium">{entry.preferredCategory}</Table.Cell>
                    <Table.Cell className="text-kumo-subtle">{entry.desiredStartDate}</Table.Cell>
                    <Table.Cell>
                      {entry.status === 'WAITING' ? (
                        <div className="w-32">
                          <p className="text-xs font-medium mb-1">
                            {matchCount > 0 ? (
                              <span className="text-kumo-success">{matchCount} unit khớp</span>
                            ) : (
                              <span className="text-kumo-subtle">Chưa có unit phù hợp</span>
                            )}
                          </p>
                          <Meter
                            label="Tỷ lệ khớp nhu cầu"
                            value={Math.min(100, matchCount * 50)}
                            showValue={false}
                          />
                        </div>
                      ) : (
                        <span className="text-kumo-subtle">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={STATUS_BADGE[entry.status].variant} appearance="dot">
                        {STATUS_BADGE[entry.status].label}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {entry.status === 'WAITING' && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            setAssigningEntry(entry);
                            const matched = getMatchedUnits(entry);
                            setSelectedUnitId(matched[0]?.id || '');
                          }}
                        >
                          Gán kho
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </div>
      </div>

      {/* Assign unit dialog */}
      <Dialog.Root
        open={!!assigningEntry}
        onOpenChange={(open) => !open && setAssigningEntry(null)}
      >
        <Dialog className="p-6">
          {assigningEntry && (
            <>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-kumo-hairline">
                <div>
                  <Dialog.Title className="text-base font-semibold">
                    Gán kho cho khách chờ
                  </Dialog.Title>
                  <Dialog.Description className="text-kumo-subtle text-sm mt-0.5">
                    {assigningEntry.customerName} • Nhu cầu: {assigningEntry.preferredCategory} •
                    Nhận kho từ {assigningEntry.desiredStartDate}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  render={
                    <Button variant="ghost" shape="square" size="sm" icon={<X />} title="Đóng" />
                  }
                />
              </div>

              <div className="space-y-2 py-4">
                <p className="text-xs text-kumo-subtle uppercase tracking-wider mb-2">
                  Danh sách kho phù hợp ({getMatchedUnits(assigningEntry).length})
                </p>

                {getMatchedUnits(assigningEntry).length === 0 ? (
                  <div className="p-4 text-center rounded-md bg-kumo-recessed text-sm text-kumo-subtle">
                    Không có kho trống nào khớp với nhu cầu của khách hàng này.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {getMatchedUnits(assigningEntry).map((unit) => (
                      <button
                        type="button"
                        key={unit.id}
                        onClick={() => setSelectedUnitId(unit.id)}
                        className={`w-full p-3 rounded-md border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          selectedUnitId === unit.id
                            ? 'border-kumo-brand bg-kumo-info-tint'
                            : 'border-kumo-hairline bg-kumo-base hover:bg-kumo-tint'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                              selectedUnitId === unit.id
                                ? 'border-kumo-brand bg-kumo-brand'
                                : 'border-kumo-hairline'
                            }`}
                          />
                          <div>
                            <p className="font-mono text-sm font-semibold">
                              {unit.code}{' '}
                              <span className="text-xs font-normal text-kumo-subtle">
                                (Tầng {unit.floor} • {unit.zone})
                              </span>
                            </p>
                            <p className="text-xs text-kumo-subtle">
                              {unit.categoryLabel} • {unit.areaM2} m²
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
                          {unit.pricePerMonth.toLocaleString('vi-VN')} ₫
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-kumo-hairline">
                <Dialog.Close
                  render={
                    <Button variant="secondary" className="flex-1">
                      Hủy
                    </Button>
                  }
                />
                <Button
                  variant="primary"
                  onClick={handleAssignUnit}
                  disabled={!selectedUnitId}
                  className="flex-1"
                >
                  Xác nhận & Gọi khách
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
