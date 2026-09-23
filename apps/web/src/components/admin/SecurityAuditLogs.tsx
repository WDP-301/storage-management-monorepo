import { Badge, Table, Tabs, Text } from '@cloudflare/kumo';
import { Lock } from '@phosphor-icons/react';
import { IAuditLog } from '@storage/types';
import React, { useState } from 'react';

interface SecurityAuditLogsProps {
  auditLogs: IAuditLog[];
}

export const SecurityAuditLogs: React.FC<SecurityAuditLogsProps> = ({ auditLogs }) => {
  const [activeTab, setActiveTab] = useState<string>('AUDIT_TRAIL');

  const loginHistoryMock = [
    {
      id: 'log-in-1',
      user: 'Nguyễn Quốc Bảo',
      role: 'FACILITY_MANAGER',
      ip: '118.69.182.45',
      device: 'Chrome 128 / macOS 15.0',
      location: 'TP. Hồ Chí Minh, VN',
      time: '2026-09-22 08:30:15',
      status: 'SUCCESS',
    },
    {
      id: 'log-in-2',
      user: 'Trần Minh Tâm',
      role: 'OPERATIONS_MANAGER',
      ip: '14.161.22.10',
      device: 'Edge 127 / Windows 11',
      location: 'Hà Nội, VN',
      time: '2026-09-22 08:15:22',
      status: 'SUCCESS',
    },
    {
      id: 'log-in-3',
      user: 'Lê Minh Quân',
      role: 'FACILITY_STAFF',
      ip: '172.16.10.4',
      device: 'Storage Mobile App / Android 14',
      location: 'Sala Mega Center Station',
      time: '2026-09-22 06:55:01',
      status: 'SUCCESS',
    },
    {
      id: 'log-in-4',
      user: 'Tài khoản lạ: admin_test',
      role: 'UNKNOWN',
      ip: '45.132.88.9',
      device: 'Python-requests / Linux',
      location: 'Frankfurt, DE (Proxy/VPN)',
      time: '2026-09-21 23:40:11',
      status: 'BLOCKED_FAILED_PASSWORD',
    },
  ];

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('CREATE') || action.includes('SUCCESS') || action.includes('APPROVE'))
      return 'success' as const;
    if (action.includes('UPDATE') || action.includes('MODIFY') || action.includes('ASSIGN'))
      return 'primary' as const;
    if (action.includes('DELETE') || action.includes('LOCK') || action.includes('BLOCK'))
      return 'error' as const;
    if (action.includes('REFUND') || action.includes('DISCOUNT')) return 'purple' as const;
    return 'neutral' as const;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Nhật ký bảo mật & audit trail
          </Text>
          <Text variant="secondary" size="sm">
            Ghi vết mọi hành vi nhạy cảm: thay đổi giá, đổi trạng thái unit, duyệt hoàn cọc và truy
            cập
          </Text>
        </div>

        <Tabs
          variant="segmented"
          size="sm"
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            { value: 'AUDIT_TRAIL', label: `Audit trail (${auditLogs.length})` },
            { value: 'LOGIN_HISTORY', label: 'Lịch sử đăng nhập' },
          ]}
        />
      </div>

      {activeTab === 'AUDIT_TRAIL' && (
        <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Thời gian</Table.Head>
                  <Table.Head>Người thực hiện</Table.Head>
                  <Table.Head>Hành động</Table.Head>
                  <Table.Head>Đối tượng tác động</Table.Head>
                  <Table.Head>IP address</Table.Head>
                  <Table.Head>Chi tiết thao tác</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {auditLogs.map((log) => (
                  <Table.Row key={log.id}>
                    <Table.Cell className="font-mono text-xs text-kumo-subtle whitespace-nowrap">
                      {log.timestamp}
                    </Table.Cell>
                    <Table.Cell>
                      <p className="font-semibold text-kumo-strong">{log.actorName}</p>
                      <p className="text-xs text-kumo-subtle font-mono">{log.actorRole}</p>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={getActionBadgeVariant(log.action)}>{log.action}</Badge>
                    </Table.Cell>
                    <Table.Cell className="font-medium">{log.target}</Table.Cell>
                    <Table.Cell className="font-mono text-xs text-kumo-subtle">
                      {log.ipAddress}
                    </Table.Cell>
                    <Table.Cell className="text-kumo-default max-w-xs">{log.details}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'LOGIN_HISTORY' && (
        <div className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Tài khoản</Table.Head>
                  <Table.Head>Thời gian</Table.Head>
                  <Table.Head>Địa chỉ IP & vị trí</Table.Head>
                  <Table.Head>Thiết bị / trình duyệt</Table.Head>
                  <Table.Head className="text-right">Trạng thái</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {loginHistoryMock.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell className="font-semibold text-kumo-strong">{item.user}</Table.Cell>
                    <Table.Cell className="font-mono text-xs text-kumo-subtle">
                      {item.time}
                    </Table.Cell>
                    <Table.Cell>
                      <p className="font-mono font-medium">{item.ip}</p>
                      <p className="text-xs text-kumo-subtle">{item.location}</p>
                    </Table.Cell>
                    <Table.Cell className="text-kumo-default">{item.device}</Table.Cell>
                    <Table.Cell className="text-right">
                      {item.status === 'SUCCESS' ? (
                        <Badge variant="success">Thành công</Badge>
                      ) : (
                        <Badge variant="error" icon={<Lock />}>
                          Chặn / sai mật khẩu
                        </Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};
