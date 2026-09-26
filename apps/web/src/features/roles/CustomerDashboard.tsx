import { Badge, Button, LayerCard, Table, Text } from '@cloudflare/kumo';
import {
  Calendar,
  CheckCircle,
  Download,
  KeyRound,
  MapPin,
  Package,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import React, { useState } from 'react';

interface CustomerRental {
  unitCode: string;
  facilityName: string;
  facilityAddress: string;
  unitType: string;
  sizeM2: number;
  monthlyRent: string;
  accessPin: string;
  nextBillingDate: string;
  status: 'ACTIVE' | 'PENDING_RENEWAL';
}

interface InvoiceRecord {
  id: string;
  code: string;
  period: string;
  amount: string;
  status: 'PAID' | 'DUE';
  date: string;
}

const MY_RENTALS: CustomerRental[] = [
  {
    unitCode: 'A-101',
    facilityName: 'Cơ sở Sài Gòn Riverside',
    facilityAddress: 'Số 12 Bến Vân Đồn, Q.4, TP.HCM',
    unitType: 'Kho gia đình Standard (Có khóa từ & camera)',
    sizeM2: 5,
    monthlyRent: '1.500.000 đ/tháng',
    accessPin: '7492',
    nextBillingDate: '15/10/2026',
    status: 'ACTIVE',
  },
];

const MY_INVOICES: InvoiceRecord[] = [
  {
    id: 'inv-01',
    code: 'INV-2026-09-001',
    period: 'Tháng 09/2026',
    amount: '1.500.000 đ',
    status: 'PAID',
    date: '15/09/2026',
  },
  {
    id: 'inv-02',
    code: 'INV-2026-08-001',
    period: 'Tháng 08/2026',
    amount: '1.500.000 đ',
    status: 'PAID',
    date: '15/08/2026',
  },
];

export const CustomerDashboard: React.FC = () => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [requestedSize, setRequestedSize] = useState('10m²');
  const [requestNote, setRequestNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [pinVisible, setPinVisible] = useState(false);

  const handleRequestChange = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(
      `Đã gửi yêu cầu chuyển đổi lên kho ${requestedSize} thành công. Ban quản lý cơ sở sẽ xét duyệt trong 24h.`,
    );
    setShowUpgradeModal(false);
    setRequestNote('');
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="h-lh flex items-center text-kumo-brand">
              <Package className="w-5 h-5" />
            </span>
            <Text as="h2">Customer storage space</Text>
            <Badge variant="success">Khách hàng thành viên</Badge>
          </div>
          <Text variant="secondary">
            Không gian lưu trữ cá nhân: quản lý kho đang thuê, lấy mã PIN ra vào cổng và hóa đơn
            thanh toán.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<PlusCircle className="w-4 h-4" />}
            onClick={() => setShowUpgradeModal(true)}
          >
            Yêu cầu đổi / Thuê thêm kho
          </Button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-kumo-success-tint text-kumo-success rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Rented Units Display */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Kho tự quản đang thuê của bạn
          </Text>
          <Text variant="secondary">
            Thông tin chi tiết ô kho, địa chỉ cơ sở và mã PIN mở cổng kỹ thuật số.
          </Text>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {MY_RENTALS.map((rental) => (
            <LayerCard key={rental.unitCode} className="px-5 py-4 ring ring-kumo-line space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-semibold text-kumo-default font-mono">
                      Ô kho {rental.unitCode}
                    </span>
                    <Badge variant="success">Đang hoạt động</Badge>
                  </div>
                  <div className="mt-1">
                    <Text as="strong" bold>
                      {rental.unitType}
                    </Text>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-semibold text-kumo-brand">
                    {rental.monthlyRent}
                  </span>
                </div>
              </div>

              <div className="grid gap-2 text-xs text-kumo-subtle bg-kumo-base p-3.5 rounded-lg border border-kumo-line">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 shrink-0 text-kumo-brand" />
                  <span>
                    <strong className="text-kumo-default">{rental.facilityName}</strong> •{' '}
                    {rental.facilityAddress}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 shrink-0 text-kumo-brand" />
                  <span>
                    Kỳ thanh toán tiếp theo:{' '}
                    <strong className="text-kumo-default">{rental.nextBillingDate}</strong>
                  </span>
                </div>
              </div>

              {/* Digital Access PIN */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-kumo-brand/5 border border-kumo-brand/20">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-5 h-5 text-kumo-brand" />
                  <div>
                    <Text as="strong" bold>
                      Mã PIN ra vào cổng kho
                    </Text>
                    <div>
                      <Text variant="secondary" size="xs">
                        Sử dụng tại bàn phím cổng an ninh 24/7
                      </Text>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-semibold text-kumo-brand px-2 py-0.5 rounded bg-kumo-base border border-kumo-line">
                    {pinVisible ? rental.accessPin : '••••'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setPinVisible(!pinVisible)}>
                    {pinVisible ? 'Ẩn' : 'Hiện'}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowUpgradeModal(true)}>
                  Yêu cầu nâng cấp diện tích
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-kumo-success">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Bảo hiểm tài sản 50tr</span>
                </div>
              </div>
            </LayerCard>
          ))}
        </div>
      </div>

      {/* Upgrade / Change Request Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <LayerCard className="max-w-md w-full p-6 ring ring-kumo-line space-y-4">
            <div className="grid gap-1">
              <Text as="h3" variant="heading">
                Yêu cầu nâng cấp hoặc đổi ô kho
              </Text>
              <Text variant="secondary" size="xs">
                Ban quản lý sẽ sắp xếp vị trí mới và hỗ trợ bạn chuyển đổi nhanh chóng.
              </Text>
            </div>

            <form onSubmit={handleRequestChange} className="space-y-3">
              <div>
                <div className="mb-1">
                  <Text size="xs">Kích cỡ mong muốn:</Text>
                </div>
                <select
                  aria-label="Kích cỡ kho mong muốn"
                  value={requestedSize}
                  onChange={(e) => setRequestedSize(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-kumo-line bg-kumo-base text-sm text-kumo-default"
                >
                  <option value="10m²">Kho doanh nghiệp Medium (10m² - 2.500.000 đ/tháng)</option>
                  <option value="12m²">Kho lớn Doanh nghiệp (12m² - 3.200.000 đ/tháng)</option>
                  <option value="15m² Lạnh">
                    Kho kiểm soát nhiệt độ (15m² - 4.500.000 đ/tháng)
                  </option>
                </select>
              </div>

              <div>
                <div className="mb-1">
                  <Text size="xs">Lý do hoặc ghi chú thêm:</Text>
                </div>
                <textarea
                  rows={3}
                  placeholder="Ghi chú thời gian muốn nhận kho..."
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-kumo-line bg-kumo-base text-sm text-kumo-default"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowUpgradeModal(false)}>
                  Hủy bỏ
                </Button>
                <Button variant="primary" type="submit">
                  Gửi yêu cầu
                </Button>
              </div>
            </form>
          </LayerCard>
        </div>
      )}

      {/* Invoices & Billing Table */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Lịch sử hóa đơn & thanh toán tiền thuê
          </Text>
          <Text variant="secondary">
            Theo dõi và tải hóa đơn GTGT điện tử các kỳ đã thanh toán.
          </Text>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã hóa đơn</Table.Head>
                <Table.Head>Kỳ cước</Table.Head>
                <Table.Head>Số tiền</Table.Head>
                <Table.Head>Ngày thanh toán</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Biên lai</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {MY_INVOICES.map((inv) => (
                <Table.Row key={inv.id}>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs font-medium text-kumo-default">
                    {inv.code}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default">
                    {inv.period}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-semibold text-kumo-brand">
                    {inv.amount}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">{inv.date}</Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    <Badge variant="success">Đã thanh toán</Badge>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Download className="w-3.5 h-3.5" />}
                      onClick={() => setNotice(`Đã tải xuống biên lai điện tử: ${inv.code}`)}
                    >
                      Tải PDF
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </LayerCard>
      </div>
    </div>
  );
};
