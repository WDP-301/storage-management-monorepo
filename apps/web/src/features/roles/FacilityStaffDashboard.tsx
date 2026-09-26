import { Badge, Button, LayerCard, Table, Text } from '@cloudflare/kumo';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface InspectionTask {
  id: string;
  unitCode: string;
  taskType: string;
  scheduledTime: string;
  status: 'PENDING' | 'DONE';
  notes?: string;
}

const INITIAL_TASKS: InspectionTask[] = [
  {
    id: 'tsk-01',
    unitCode: 'A-101',
    taskType: 'Kiểm tra ổ khóa & niêm phong',
    scheduledTime: '08:30',
    status: 'DONE',
    notes: 'Khóa tốt, tem nguyên vẹn',
  },
  {
    id: 'tsk-02',
    unitCode: 'A-102',
    taskType: 'Đo độ ẩm & nhiệt độ kho',
    scheduledTime: '09:15',
    status: 'DONE',
    notes: 'Độ ẩm 52%, đạt chuẩn',
  },
  {
    id: 'tsk-03',
    unitCode: 'B-201',
    taskType: 'Kiểm tra bẫy côn trùng & vệ sinh hành lang',
    scheduledTime: '10:00',
    status: 'PENDING',
  },
  {
    id: 'tsk-04',
    unitCode: 'B-202',
    taskType: 'Nghiệm thu sau bảo trì sửa chữa',
    scheduledTime: '11:00',
    status: 'PENDING',
  },
  {
    id: 'tsk-05',
    unitCode: 'A-103',
    taskType: 'Kiểm tra cảm biến khói & lối thoát hiểm',
    scheduledTime: '14:00',
    status: 'PENDING',
  },
];

export const FacilityStaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<InspectionTask[]>(INITIAL_TASKS);
  const [checkInPin, setCheckInPin] = useState('');
  const [verifiedCustomer, setVerifiedCustomer] = useState<{
    name: string;
    unit: string;
    status: string;
  } | null>(null);
  const [incidentUnit, setIncidentUnit] = useState('');
  const [incidentType, setIncidentType] = useState('Ổ khóa bị kẹt');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const markTaskDone = (taskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'DONE' } : t)));
    setNotice('Đã đánh dấu hoàn thành nhiệm vụ kiểm tra kho.');
    setTimeout(() => setNotice(null), 4000);
  };

  const handleVerifyAccess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInPin.trim()) return;

    if (checkInPin.trim() === '7492' || checkInPin.trim().toUpperCase() === 'PIN-7492') {
      setVerifiedCustomer({
        name: 'Hoàng Minh (Khách hàng)',
        unit: 'A-101 (Kho gia đình 5m²)',
        status: 'Hợp lệ • Hợp đồng ACTIVE',
      });
      setNotice('Xác minh mã truy cập thành công! Đã cấp quyền mở cổng.');
    } else {
      setVerifiedCustomer({
        name: 'Khách hàng vãng lai',
        unit: `Kho ${checkInPin.toUpperCase()}`,
        status: 'Hợp lệ • Đã quét mã vào ca',
      });
      setNotice(`Xác minh thành công mã ${checkInPin}.`);
    }
    setTimeout(() => setNotice(null), 4000);
  };

  const handleReportIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentUnit.trim()) return;

    setNotice(
      `Đã ghi nhận báo cáo sự cố tại kho ${incidentUnit}: ${incidentType}. Đã gửi thông báo đến Quản lý cơ sở.`,
    );
    setIncidentUnit('');
    setIncidentDesc('');
    setTimeout(() => setNotice(null), 5000);
  };

  const completedCount = tasks.filter((t) => t.status === 'DONE').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center gap-2">
            <span className="h-lh flex items-center text-kumo-brand">
              <ClipboardCheck className="w-5 h-5" />
            </span>
            <Text as="h2">Facility staff console</Text>
            <Badge variant="warning">Nhân sự ca trực kho</Badge>
          </div>
          <Text variant="secondary">
            Bảng điều khiển tác nghiệp tại chỗ: hỗ trợ check-in, thực hiện danh mục kiểm tra ca và
            báo cáo sự cố.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="primary" appearance="dot">
            Nhân viên ca trực: {user?.fullName}
          </Badge>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-kumo-success-tint text-kumo-success rounded-lg text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Shift Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Ca trực hiện tại</Text>
            <Badge variant="primary">Ca sáng A1</Badge>
          </div>
          <div className="mt-2">
            <span className="text-xl font-semibold text-kumo-default">08:00 - 16:00</span>
          </div>
          <div className="mt-1">
            <Text variant="secondary" size="xs">
              Cơ sở Sài Gòn Riverside
            </Text>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Tiến độ kiểm tra kho</Text>
            <ShieldCheck className="w-4 h-4 text-kumo-success" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">
              {completedCount} / {tasks.length}
            </span>
            <Badge variant="success">
              Hoàn thành {Math.round((completedCount / tasks.length) * 100)}%
            </Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Khách ra vào ca này</Text>
            <UserCheck className="w-4 h-4 text-kumo-brand" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">12 Lượt</span>
            <Badge variant="neutral">Bình thường</Badge>
          </div>
        </LayerCard>

        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center justify-between">
            <Text variant="secondary">Cảnh báo ổ khóa / Overlock</Text>
            <Lock className="w-4 h-4 text-kumo-warning" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-kumo-default">0 Vụ</span>
            <Badge variant="success">An toàn</Badge>
          </div>
        </LayerCard>
      </div>

      {/* Two Column Section: Quick Check-in Tool + Incident Report */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Access / Check-in Tool */}
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="w-4 h-4 text-kumo-brand" />
            <Text as="h3" variant="heading">
              Xác minh mã truy cập & mở cổng kho
            </Text>
          </div>
          <div className="mb-4">
            <Text variant="secondary" size="xs">
              Nhập mã PIN hoặc mã đặt chỗ (ví dụ: 7492) để đối soát quyền mở cổng và kiểm tra hợp
              đồng của khách.
            </Text>
          </div>

          <form onSubmit={handleVerifyAccess} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nhập mã PIN (vd: 7492)..."
                value={checkInPin}
                onChange={(e) => setCheckInPin(e.target.value)}
                className="flex-1 h-9 px-3 rounded-lg border border-kumo-line bg-kumo-base text-sm text-kumo-default"
              />
              <Button variant="primary" type="submit">
                Kiểm tra
              </Button>
            </div>
          </form>

          {verifiedCustomer && (
            <div className="mt-4 p-3.5 rounded-lg bg-kumo-success-tint border border-kumo-success/20 text-kumo-default text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-kumo-success">{verifiedCustomer.name}</span>
                <Badge variant="success">Hợp lệ</Badge>
              </div>
              <p>
                Ô kho: <span className="font-mono font-medium">{verifiedCustomer.unit}</span>
              </p>
              <p className="text-kumo-subtle">{verifiedCustomer.status}</p>
            </div>
          )}
        </LayerCard>

        {/* Quick Incident Reporting */}
        <LayerCard className="px-5 py-4 ring ring-kumo-line">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-kumo-danger" />
            <Text as="h3" variant="heading">
              Báo cáo nhanh sự cố phát sinh
            </Text>
          </div>
          <div className="mb-4">
            <Text variant="secondary" size="xs">
              Ghi nhận ổ khóa hư hại, độ ẩm bất thường hoặc phát hiện sự cố tại hiện trường.
            </Text>
          </div>

          <form onSubmit={handleReportIncident} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Mã kho (vd: A-102)..."
                value={incidentUnit}
                onChange={(e) => setIncidentUnit(e.target.value)}
                className="h-9 px-3 rounded-lg border border-kumo-line bg-kumo-base text-sm text-kumo-default"
                required
              />
              <select
                aria-label="Loại sự cố phát sinh"
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value)}
                className="h-9 px-2 rounded-lg border border-kumo-line bg-kumo-base text-xs text-kumo-default"
              >
                <option value="Ổ khóa bị kẹt">Ổ khóa bị kẹt</option>
                <option value="Cảnh báo nhiệt độ">Nhiệt độ/Độ ẩm cao</option>
                <option value="Vấn đề vệ sinh">Cần vệ sinh khử khuẩn</option>
                <option value="Đèn chiếu sáng hỏng">Đèn lối đi hỏng</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Ghi chú chi tiết sự cố..."
              value={incidentDesc}
              onChange={(e) => setIncidentDesc(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-kumo-line bg-kumo-base text-sm text-kumo-default"
            />
            <Button variant="secondary-destructive" type="submit" size="sm">
              Gửi báo cáo sự cố
            </Button>
          </form>
        </LayerCard>
      </div>

      {/* Shift Checklist Table */}
      <div className="space-y-3">
        <div className="grid gap-1">
          <Text as="h3" variant="heading">
            Danh mục kiểm tra ca trực hôm nay
          </Text>
          <Text variant="secondary">
            Các nhiệm vụ an toàn, niêm phong và bảo quản cần kiểm tra định kỳ trong ca trực.
          </Text>
        </div>

        <LayerCard className="overflow-x-auto p-0 ring ring-kumo-line">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Giờ kiểm tra</Table.Head>
                <Table.Head>Mã kho</Table.Head>
                <Table.Head>Nội dung kiểm tra</Table.Head>
                <Table.Head>Ghi chú hiện trường</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head className="text-right">Hành động</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tasks.map((task) => (
                <Table.Row key={task.id}>
                  <Table.Cell className="whitespace-nowrap font-mono text-xs text-kumo-subtle">
                    {task.scheduledTime}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap font-mono font-semibold text-kumo-default">
                    {task.unitCode}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-default font-medium">
                    {task.taskType}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle text-xs">
                    {task.notes || 'Chưa có ghi chú'}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap">
                    {task.status === 'DONE' ? (
                      <Badge variant="success">Đã hoàn thành</Badge>
                    ) : (
                      <Badge variant="warning">Chưa kiểm tra</Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-right">
                    {task.status === 'PENDING' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CheckCircle className="w-3.5 h-3.5" />}
                        onClick={() => markTaskDone(task.id)}
                      >
                        Xác nhận xong
                      </Button>
                    ) : (
                      <span className="text-xs text-kumo-success">Đạt yêu cầu</span>
                    )}
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
