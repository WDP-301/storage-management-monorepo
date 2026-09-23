import { Badge, Button, Dialog, Input, Table, Tabs, Text } from '@cloudflare/kumo';
import { FileText, MagnifyingGlass, QrCode, X } from '@phosphor-icons/react';
import { ContractStatus, IRentalContract } from '@storage/types';
import React, { useState } from 'react';

interface ContractTrackingProps {
  contracts: IRentalContract[];
}

const STATUS_BADGE: Record<
  ContractStatus,
  { variant: 'primary' | 'warning' | 'error' | 'purple' | 'neutral' | 'secondary'; label: string }
> = {
  [ContractStatus.ACTIVE]: { variant: 'primary', label: 'Đang thuê' },
  [ContractStatus.EXPIRING_SOON]: { variant: 'warning', label: 'Sắp hết hạn' },
  [ContractStatus.OVERDUE]: { variant: 'error', label: 'Quá hạn' },
  [ContractStatus.PENDING_HANDOVER]: { variant: 'purple', label: 'Chờ nhận kho' },
  [ContractStatus.RETURN_REQUESTED]: { variant: 'warning', label: 'Yêu cầu trả' },
  [ContractStatus.COMPLETED]: { variant: 'neutral', label: 'Đã thanh lý' },
  [ContractStatus.CANCELLED]: { variant: 'neutral', label: 'Đã hủy' },
};

export const ContractTracking: React.FC<ContractTrackingProps> = ({
  contracts: initialContracts,
}) => {
  const [contracts, setContracts] = useState<IRentalContract[]>(initialContracts);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [settlingContract, setSettlingContract] = useState<IRentalContract | null>(null);
  const [damageDeductions, setDamageDeductions] = useState<number>(0);
  const [damageReason, setDamageReason] = useState<string>('');

  const filteredContracts = contracts.filter((c) => {
    const matchSearch =
      c.contractCode.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.unitCode.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleConfirmSettlement = () => {
    if (!settlingContract) return;
    const finalRefund = Math.max(0, settlingContract.depositAmount - damageDeductions);
    setContracts((prev) =>
      prev.map((c) =>
        c.id === settlingContract.id
          ? {
              ...c,
              status: ContractStatus.COMPLETED,
              damageDeductions,
              refundAmount: finalRefund,
            }
          : c,
      ),
    );
    alert(
      `Đã tất toán hợp đồng ${settlingContract.contractCode}. Hoàn lại ${finalRefund.toLocaleString('vi-VN')} ₫ cọc sau khi cấn trừ hư hại!`,
    );
    setSettlingContract(null);
    setDamageDeductions(0);
    setDamageReason('');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Hợp đồng & quyết toán tiền cọc
          </Text>
          <Text variant="secondary" size="sm">
            Thời hạn thuê, công nợ và quy trình thanh lý cấn trừ hư hại
          </Text>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<FileText />}
          onClick={() => alert('Mở form tạo hợp đồng mới')}
        >
          Soạn hợp đồng mới
        </Button>
      </div>

      {/* Search + status filter */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4 space-y-3">
        <div className="relative w-full">
          <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-kumo-placeholder z-10" />
          <Input
            aria-label="Tìm hợp đồng"
            placeholder="Tìm theo mã hợp đồng, tên khách hoặc mã kho..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-kumo-hairline">
          <Text variant="secondary" size="xs">
            Trạng thái:
          </Text>
          <Tabs
            variant="segmented"
            size="sm"
            value={statusFilter}
            onValueChange={setStatusFilter}
            tabs={[
              { value: 'ALL', label: 'Tất cả' },
              { value: ContractStatus.ACTIVE, label: 'Đang hiệu lực' },
              { value: ContractStatus.EXPIRING_SOON, label: 'Sắp hết hạn' },
              { value: ContractStatus.OVERDUE, label: 'Quá hạn' },
              { value: ContractStatus.PENDING_HANDOVER, label: 'Chờ bàn giao' },
              { value: ContractStatus.COMPLETED, label: 'Đã thanh lý' },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã HĐ</Table.Head>
                <Table.Head>Mã kho</Table.Head>
                <Table.Head>Khách hàng</Table.Head>
                <Table.Head>Thời hạn thuê</Table.Head>
                <Table.Head>Tiền thuê / cọc</Table.Head>
                <Table.Head>Mã QR / PIN</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Quyết toán cọc</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredContracts.map((ctr) => (
                <Table.Row key={ctr.id}>
                  <Table.Cell className="font-mono font-semibold">{ctr.contractCode}</Table.Cell>
                  <Table.Cell>
                    <Badge variant="outline">{ctr.unitCode}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <p className="font-medium text-kumo-strong">{ctr.customerName}</p>
                      <p className="text-xs text-kumo-subtle">{ctr.customerPhone}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-kumo-default">
                      {ctr.startDate} → {ctr.endDate}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <span className="font-medium text-kumo-strong tabular-nums">
                        {ctr.monthlyRent.toLocaleString('vi-VN')} ₫/th
                      </span>
                      <p className="text-xs text-kumo-subtle">
                        Cọc: {ctr.depositAmount.toLocaleString('vi-VN')} ₫
                      </p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="font-mono text-xs space-y-0.5">
                      <p className="flex items-center gap-1 text-kumo-default">
                        <QrCode className="w-3.5 h-3.5 text-kumo-subtle" />
                        {ctr.qrPassCode}
                      </p>
                      <p className="text-kumo-subtle">PIN: {ctr.pinCode}</p>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={STATUS_BADGE[ctr.status].variant} appearance="dot">
                      {STATUS_BADGE[ctr.status].label}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {ctr.status !== ContractStatus.COMPLETED ? (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => setSettlingContract(ctr)}
                      >
                        Quyết toán cọc
                      </Button>
                    ) : (
                      <span className="text-xs text-kumo-subtle">Đã hoàn tất</span>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </div>

      {/* Settlement dialog */}
      <Dialog.Root
        open={!!settlingContract}
        onOpenChange={(open) => !open && setSettlingContract(null)}
      >
        <Dialog className="p-6">
          {settlingContract && (
            <>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-kumo-hairline">
                <div>
                  <Dialog.Title className="text-base font-semibold">
                    Quyết toán tiền cọc & trả kho
                  </Dialog.Title>
                  <Dialog.Description className="text-kumo-subtle text-sm mt-0.5">
                    HĐ {settlingContract.contractCode} • Kho {settlingContract.unitCode}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  render={
                    <Button variant="ghost" shape="square" size="sm" icon={<X />} title="Đóng" />
                  }
                />
              </div>

              <div className="mt-4 p-3.5 rounded-md bg-kumo-recessed text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-kumo-subtle">Khách hàng</span>
                  <span className="font-semibold text-kumo-strong">
                    {settlingContract.customerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-kumo-subtle">Tiền cọc ban đầu</span>
                  <span className="font-semibold text-kumo-strong tabular-nums">
                    {settlingContract.depositAmount.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>

              <div className="space-y-4 py-4">
                <Input
                  label="Khấu trừ hư hại / vệ sinh (nếu có)"
                  type="number"
                  placeholder="0 ₫"
                  value={damageDeductions || ''}
                  onChange={(e) => setDamageDeductions(Number(e.target.value))}
                />
                <Input
                  label="Lý do khấu trừ (theo biên bản nghiệm thu)"
                  placeholder="Ví dụ: móp cửa cuốn, phí dọn rác tồn đọng..."
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                />

                <div className="p-3 rounded-md bg-kumo-success-tint flex items-center justify-between">
                  <span className="text-sm font-semibold text-kumo-success">Hoàn cọc thực tế</span>
                  <span className="font-semibold text-kumo-success tabular-nums">
                    {Math.max(0, settlingContract.depositAmount - damageDeductions).toLocaleString(
                      'vi-VN',
                    )}{' '}
                    ₫
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-kumo-hairline">
                <Dialog.Close
                  render={
                    <Button variant="secondary" className="flex-1">
                      Hủy
                    </Button>
                  }
                />
                <Button variant="primary" onClick={handleConfirmSettlement} className="flex-1">
                  Xác nhận hoàn cọc
                </Button>
              </div>
            </>
          )}
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
