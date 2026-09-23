import { Badge, Button, Dialog, Input, Switch, Text } from '@cloudflare/kumo';
import { Plus, ShieldCheck, X } from '@phosphor-icons/react';
import { IPermissionTemplate } from '@storage/types';
import React, { useState } from 'react';

interface RolePermissionsProps {
  permissionTemplates: IPermissionTemplate[];
}

export const RolePermissions: React.FC<RolePermissionsProps> = ({
  permissionTemplates: initialTemplates,
}) => {
  const [templates, setTemplates] = useState<IPermissionTemplate[]>(initialTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<IPermissionTemplate>(templates[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

  const togglePermission = (key: keyof IPermissionTemplate['permissions']) => {
    const updated = {
      ...selectedTemplate,
      permissions: {
        ...selectedTemplate.permissions,
        [key]: !selectedTemplate.permissions[key],
      },
    };
    setSelectedTemplate(updated);
    setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName) return;
    const newTmpl: IPermissionTemplate = {
      id: `tmpl-${Date.now()}`,
      name: newTemplateName,
      description: newTemplateDesc,
      userCount: 0,
      permissions: {
        canViewFinancials: false,
        canApproveRefund: false,
        canAssignUnits: true,
        canModifyPricing: false,
        canInspectUnits: true,
        canManageStaff: false,
        canViewSystemLogs: false,
      },
    };
    setTemplates([...templates, newTmpl]);
    setSelectedTemplate(newTmpl);
    setShowCreateModal(false);
    setNewTemplateName('');
    setNewTemplateDesc('');
    alert(`Đã tạo thành công Permission Template mới: ${newTemplateName}`);
  };

  const permissionLabels: {
    key: keyof IPermissionTemplate['permissions'];
    label: string;
    desc: string;
  }[] = [
    {
      key: 'canViewFinancials',
      label: 'Xem báo cáo doanh thu & dòng tiền',
      desc: 'Cho phép xem tổng doanh thu, biểu phí và lịch sử dòng tiền cọc của cơ sở.',
    },
    {
      key: 'canApproveRefund',
      label: 'Phê duyệt hoàn cọc & cấn trừ hư hại',
      desc: 'Thực hiện thanh lý hợp đồng và kích hoạt chuyển tiền hoàn cọc cho khách hàng.',
    },
    {
      key: 'canAssignUnits',
      label: 'Gán unit & điều phối mặt bằng',
      desc: 'Sử dụng công cụ auto-assign hoặc gán thủ công kho cho hợp đồng mới.',
    },
    {
      key: 'canModifyPricing',
      label: 'Chỉnh sửa bảng giá & biểu phí phạt',
      desc: 'Quyền thay đổi đơn giá thuê niêm yết và chính sách phạt quá hạn.',
    },
    {
      key: 'canInspectUnits',
      label: 'Thực hiện nghiệm thu & chụp ảnh hiện trường',
      desc: 'Lập biên bản bàn giao, kiểm tra tình trạng vệ sinh và ghi nhận bồi thường.',
    },
    {
      key: 'canManageStaff',
      label: 'Phân công ca trực & quản lý nhân sự',
      desc: 'Giao việc cho nhân viên, kiểm tra workload và duyệt bàn giao ca.',
    },
    {
      key: 'canViewSystemLogs',
      label: 'Xem nhật ký bảo mật & audit trail',
      desc: 'Truy cập toàn bộ audit logs về hành vi nghiệp vụ và lịch sử IP đăng nhập.',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Mẫu phân quyền & ma trận RBAC
          </Text>
          <Text variant="secondary" size="sm">
            Permission templates chuẩn áp dụng 1-click cho nhân sự theo từng cơ sở
          </Text>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus />}
          onClick={() => setShowCreateModal(true)}
        >
          Tạo template mới
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Template list */}
        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-kumo-hairline">
            <Text bold size="sm">
              Mẫu quyền ({templates.length})
            </Text>
            <Badge variant="purple">1-click gán quyền</Badge>
          </div>

          <div className="space-y-2">
            {templates.map((tmpl) => {
              const isSelected = selectedTemplate.id === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`w-full text-left p-3 rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-kumo-brand bg-kumo-info-tint'
                      : 'border-kumo-hairline bg-kumo-base hover:bg-kumo-tint'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-kumo-strong">{tmpl.name}</span>
                    <Badge variant="purple">{tmpl.userCount} users</Badge>
                  </div>
                  <p className="text-xs text-kumo-subtle mt-1 line-clamp-2">{tmpl.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Permission matrix detail */}
        <div className="lg:col-span-2 rounded-md border border-kumo-hairline bg-kumo-base p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-kumo-hairline gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-kumo-brand" />
                <Text bold size="sm">
                  {selectedTemplate.name}
                </Text>
              </div>
              <Text variant="secondary" size="xs">
                {selectedTemplate.description}
              </Text>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                alert(`Áp dụng mẫu quyền "${selectedTemplate.name}" cho nhóm nhân viên.`)
              }
            >
              Gán cho nhân sự
            </Button>
          </div>

          <div className="space-y-2">
            {permissionLabels.map((perm) => {
              const isEnabled = selectedTemplate.permissions[perm.key];
              return (
                <div
                  key={perm.key}
                  className="flex items-center justify-between gap-4 p-3 rounded-md border border-kumo-hairline bg-kumo-recessed hover:bg-kumo-tint transition-colors"
                >
                  <div className="pr-4">
                    <p className="text-sm font-semibold text-kumo-default">{perm.label}</p>
                    <p className="text-xs text-kumo-subtle mt-0.5">{perm.desc}</p>
                  </div>

                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => togglePermission(perm.key)}
                    aria-label={perm.label}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Create template dialog */}
      <Dialog.Root open={showCreateModal} onOpenChange={setShowCreateModal}>
        <Dialog className="p-6">
          <form onSubmit={handleCreateTemplate}>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-kumo-hairline">
              <Dialog.Title className="text-base font-semibold">
                Tạo mẫu phân quyền mới
              </Dialog.Title>
              <Dialog.Close
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    shape="square"
                    size="sm"
                    icon={<X />}
                    title="Đóng"
                  />
                }
              />
            </div>

            <div className="space-y-4 py-4">
              <Input
                label="Tên template quyền"
                required
                placeholder="Ví dụ: Kế toán cơ sở / Kỹ thuật viên ca đêm..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />

              <Input
                label="Mô tả mục đích sử dụng"
                required
                placeholder="Mẫu phân quyền chuẩn áp dụng cho bộ phận tài chính..."
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-kumo-hairline">
              <Dialog.Close
                render={
                  <Button type="button" variant="secondary" className="flex-1">
                    Hủy
                  </Button>
                }
              />
              <Button variant="primary" type="submit" className="flex-1">
                Lưu template
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
