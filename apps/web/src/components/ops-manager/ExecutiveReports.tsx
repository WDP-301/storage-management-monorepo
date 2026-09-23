import { Badge, Button, Table, Text } from '@cloudflare/kumo';
import { FileXls, Printer, TrendUp } from '@phosphor-icons/react';
import React from 'react';

export const ExecutiveReports: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Báo cáo hiệu suất & tài chính toàn hệ thống
          </Text>
          <Text variant="secondary" size="sm">
            Doanh thu, tiền cọc đang lưu ký, tỷ lệ lấp đầy lịch sử và công nợ quá hạn
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<FileXls />}
            onClick={() => alert('Xuất file Excel báo cáo chi tiết thành công!')}
          >
            Xuất Excel (.xlsx)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Printer />}
            onClick={() => alert('Đang tạo bản in báo cáo PDF...')}
          >
            In / PDF
          </Button>
        </div>
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4">
          <p className="text-xs text-kumo-subtle uppercase tracking-wider">
            Doanh thu cho thuê thuần
          </p>
          <p className="text-2xl font-semibold text-kumo-strong mt-1 tabular-nums">715.600.000 ₫</p>
          <p className="text-sm text-kumo-success font-medium mt-2 flex items-center gap-1">
            <TrendUp className="w-3.5 h-3.5" />
            +14.2% so với tháng trước
          </p>
        </div>

        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4">
          <p className="text-xs text-kumo-subtle uppercase tracking-wider">
            Tổng tiền cọc đang lưu ký
          </p>
          <p className="text-2xl font-semibold text-kumo-info mt-1 tabular-nums">945.000.000 ₫</p>
          <p className="text-sm text-kumo-subtle mt-2">Bảo toàn tài chính an toàn 100%</p>
        </div>

        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4">
          <p className="text-xs text-kumo-subtle uppercase tracking-wider">
            Công nợ quá hạn cần thu hồi
          </p>
          <p className="text-2xl font-semibold text-kumo-danger mt-1 tabular-nums">18.500.000 ₫</p>
          <p className="text-sm text-kumo-danger font-medium mt-2">Chiếm 2.1% tổng doanh thu</p>
        </div>
      </div>

      {/* Performance by facility */}
      <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
        <div className="p-4 border-b border-kumo-hairline flex items-center justify-between">
          <Text bold size="sm">
            Bảng kê chi tiết từng chi nhánh (tháng 09/2026)
          </Text>
          <span className="text-xs text-kumo-subtle font-mono">Đơn vị: VNĐ</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Chi nhánh</Table.Head>
                <Table.Head>Công suất</Table.Head>
                <Table.Head>Tiền thuê đã thu</Table.Head>
                <Table.Head>Cọc mới phát sinh</Table.Head>
                <Table.Head>Phí phạt hư hại</Table.Head>
                <Table.Head>Đã hoàn cọc</Table.Head>
                <Table.Head className="text-right">Tổng dòng tiền thực</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <Table.Row>
                <Table.Cell className="font-semibold text-kumo-strong">
                  StorageHub Sala (TP.HCM)
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="primary">86.6%</Badge>
                </Table.Cell>
                <Table.Cell className="font-medium tabular-nums">412.500.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-info tabular-nums">65.000.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-danger tabular-nums">2.450.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-subtle tabular-nums">18.500.000 ₫</Table.Cell>
                <Table.Cell className="text-right font-semibold text-kumo-success tabular-nums">
                  461.450.000 ₫
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell className="font-semibold text-kumo-strong">
                  StorageHub Times City (Hà Nội)
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="warning">90.0%</Badge>
                </Table.Cell>
                <Table.Cell className="font-medium tabular-nums">324.000.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-info tabular-nums">42.000.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-danger tabular-nums">800.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-subtle tabular-nums">12.000.000 ₫</Table.Cell>
                <Table.Cell className="text-right font-semibold text-kumo-success tabular-nums">
                  354.800.000 ₫
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell className="font-semibold text-kumo-strong">
                  StorageHub Đà Nẵng Riverside
                </Table.Cell>
                <Table.Cell>
                  <Badge variant="secondary">70.8%</Badge>
                </Table.Cell>
                <Table.Cell className="font-medium tabular-nums">155.900.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-info tabular-nums">18.500.000 ₫</Table.Cell>
                <Table.Cell className="text-kumo-danger tabular-nums">0 ₫</Table.Cell>
                <Table.Cell className="text-kumo-subtle tabular-nums">6.000.000 ₫</Table.Cell>
                <Table.Cell className="text-right font-semibold text-kumo-success tabular-nums">
                  168.400.000 ₫
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </div>
      </div>
    </div>
  );
};
