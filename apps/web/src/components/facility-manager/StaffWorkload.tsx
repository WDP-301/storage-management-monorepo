import { Badge, Banner, Button, Meter, Table, Tabs, Text } from '@cloudflare/kumo';
import { CheckCircle, Clock, Key, Plus, ShieldWarning } from '@phosphor-icons/react';
import { IKeyInventoryItem, IShiftHandoverNote, IStaffMember } from '@storage/types';
import React, { useState } from 'react';

interface StaffWorkloadProps {
  staffList: IStaffMember[];
  shiftNotes: IShiftHandoverNote[];
  keyInventory: IKeyInventoryItem[];
}

export const StaffWorkload: React.FC<StaffWorkloadProps> = ({
  staffList,
  shiftNotes,
  keyInventory,
}) => {
  const [activeTab, setActiveTab] = useState<string>('WORKLOAD');

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Nhân sự, ca trực & kho khóa
          </Text>
          <Text variant="secondary" size="sm">
            Phân bổ khối lượng công việc, bàn giao ca trực và thiết bị cơ sở
          </Text>
        </div>

        <Tabs
          variant="segmented"
          size="sm"
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            { value: 'WORKLOAD', label: 'Workload' },
            { value: 'SHIFT_NOTES', label: 'Bàn giao ca' },
            { value: 'KEYS', label: `Thẻ & khóa (${keyInventory.length})` },
          ]}
        />
      </div>

      {activeTab === 'WORKLOAD' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {staffList.map((st) => (
            <div
              key={st.id}
              className="rounded-md border border-kumo-hairline bg-kumo-base p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={st.avatarUrl}
                      alt={st.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="space-y-0.5">
                      <Text bold size="sm">
                        {st.name}
                      </Text>
                      <Text variant="secondary" size="xs">
                        {st.role}
                      </Text>
                    </div>
                  </div>
                  <Badge variant="primary">{st.shift}</Badge>
                </div>

                <div className="mt-5 space-y-3">
                  <Meter
                    label={`${st.activeTasksCount} tác vụ đang xử lý`}
                    value={Math.min(100, (st.activeTasksCount / 5) * 100)}
                    showValue={false}
                  />

                  <div className="grid grid-cols-2 gap-2 text-sm pt-3 border-t border-kumo-hairline">
                    <div className="p-2.5 rounded-md bg-kumo-recessed">
                      <Text variant="secondary" size="xs">
                        Xong hôm nay
                      </Text>
                      <p className="font-semibold text-kumo-strong mt-0.5">
                        {st.completedTodayCount} tasks
                      </p>
                    </div>
                    <div className="p-2.5 rounded-md bg-kumo-success-tint">
                      <Text variant="secondary" size="xs">
                        Điểm KPI
                      </Text>
                      <p className="font-semibold text-kumo-success mt-0.5">
                        {st.performanceScore}/100
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-kumo-hairline">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => alert(`Giao việc mới cho nhân viên ${st.name}`)}
                >
                  Phân công nhiệm vụ mới
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'SHIFT_NOTES' && (
        <div className="space-y-4">
          {shiftNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border border-kumo-hairline bg-kumo-base p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-kumo-hairline gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="primary">{note.shift}</Badge>
                  <Text variant="secondary" size="xs">
                    Ngày {note.date}
                  </Text>
                </div>
                <Text variant="secondary" size="sm">
                  {note.fromStaffName} → {note.toStaffName}
                </Text>
              </div>

              <div className="space-y-3">
                <div>
                  <Text bold size="sm">
                    Tóm tắt ca trực
                  </Text>
                  <p className="text-sm text-kumo-default mt-1 bg-kumo-recessed p-3 rounded-md">
                    {note.keySummary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-kumo-warning-tint">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Việc tồn đọng ({note.pendingTasks.length})
                    </p>
                    <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                      {note.pendingTasks.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-md bg-kumo-success-tint">
                    <p className="text-sm font-semibold flex items-center gap-1.5 text-kumo-success">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Sự cố đã khắc phục
                    </p>
                    <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                      {note.resolvedIssues.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {note.urgentAlerts && (
                  <Banner
                    variant="error"
                    size="sm"
                    icon={<ShieldWarning />}
                    title={note.urgentAlerts}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'KEYS' && (
        <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
          <div className="p-4 border-b border-kumo-hairline flex items-center justify-between">
            <Text bold size="sm" as="span">
              <Key className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
              Kiểm kê thẻ RFID, chìa khóa & ổ khóa
            </Text>
            <Button
              variant="primary"
              size="xs"
              icon={<Plus />}
              onClick={() => alert('Thêm chìa khóa / thẻ từ mới vào tủ kho.')}
            >
              Nhập thêm
            </Button>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Mã thẻ / khóa</Table.Head>
                <Table.Head>Loại thiết bị</Table.Head>
                <Table.Head>Unit được gán</Table.Head>
                <Table.Head>Trạng thái</Table.Head>
                <Table.Head>Kiểm kê gần nhất</Table.Head>
                <Table.Head className="text-right">Thao tác</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {keyInventory.map((item) => (
                <Table.Row key={item.id}>
                  <Table.Cell className="font-mono font-semibold">{item.code}</Table.Cell>
                  <Table.Cell>
                    {item.type === 'ACCESS_CARD' && 'Thẻ từ RFID'}
                    {item.type === 'PHYSICAL_KEY' && 'Chìa khóa cơ'}
                    {item.type === 'SMART_PADLOCK' && 'Ổ khóa số / Bluetooth'}
                  </Table.Cell>
                  <Table.Cell>
                    {item.assignedUnitCode ? (
                      <Badge variant="primary">{item.assignedUnitCode}</Badge>
                    ) : (
                      <span className="text-kumo-subtle">Chưa gán</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {item.status === 'IN_STOCK' ? (
                      <Badge variant="success" appearance="dot">
                        Trong tủ
                      </Badge>
                    ) : (
                      <Badge variant="neutral" appearance="dot">
                        Đang giao khách
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-kumo-subtle">{item.lastCheckedAt}</Table.Cell>
                  <Table.Cell className="text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => alert(`Thu hồi hoặc cấp phát lại mã ${item.code}`)}
                    >
                      Cập nhật
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
};
