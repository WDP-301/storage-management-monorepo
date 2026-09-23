import { Badge, Banner, Button, Text } from '@cloudflare/kumo';
import { Camera, CheckCircle, Plus, Warning } from '@phosphor-icons/react';
import { IInspectionRecord } from '@storage/types';
import React from 'react';

interface MaintenanceLogsProps {
  inspections: IInspectionRecord[];
}

export const MaintenanceLogs: React.FC<MaintenanceLogsProps> = ({ inspections }) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Biên bản nghiệm thu & bàn giao
          </Text>
          <Text variant="secondary" size="sm">
            Lưu vết kiểm tra hiện trường lúc nhận kho (check-in) và hoàn trả (check-out)
          </Text>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus />}
          onClick={() => alert('Mở form lập biên bản kiểm tra kho mới.')}
        >
          Lập biên bản mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {inspections.map((insp) => (
          <div
            key={insp.id}
            className="rounded-md border border-kumo-hairline bg-kumo-base p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-kumo-recessed flex items-center justify-center font-mono text-xs font-semibold">
                  {insp.unitCode}
                </div>
                <div className="space-y-0.5">
                  <Text bold size="sm">
                    {insp.type === 'HANDOVER'
                      ? 'Biên bản bàn giao nhận kho'
                      : insp.type === 'RETURN'
                        ? 'Biên bản nghiệm thu trả kho'
                        : 'Biên bản kiểm tra định kỳ'}
                  </Text>
                  <Text variant="secondary" size="xs">
                    {insp.inspectedAt}
                  </Text>
                </div>
              </div>

              {insp.status === 'PASSED' ? (
                <Badge variant="success" icon={<CheckCircle />}>
                  Đạt chuẩn
                </Badge>
              ) : (
                <Badge variant="error" icon={<Warning />}>
                  Có hư hại
                </Badge>
              )}
            </div>

            <div className="text-sm space-y-1">
              <p className="text-kumo-default">
                Nhân viên thực hiện:{' '}
                <span className="font-semibold text-kumo-strong">{insp.staffName}</span>
              </p>
              <p className="text-kumo-default">
                Điểm vệ sinh:{' '}
                <span className="font-semibold text-kumo-strong">{insp.cleanlinessScore}/5</span>
              </p>
            </div>

            {insp.hasDamage && (
              <Banner
                variant="error"
                size="sm"
                title="Hư hỏng ghi nhận"
                description={
                  <>
                    {insp.damageDescription} — Phí bồi thường:{' '}
                    <strong>{insp.damageFine.toLocaleString('vi-VN')} ₫</strong>
                  </>
                }
              />
            )}

            <div>
              <p className="text-xs text-kumo-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                Ảnh hiện trường ({insp.photoUrls.length})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {insp.photoUrls.map((url) => (
                  <div
                    key={url}
                    className="rounded-md overflow-hidden aspect-video border border-kumo-hairline"
                  >
                    <img src={url} alt="Hiện trường" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-kumo-hairline flex items-center justify-between">
              <Text variant="secondary" size="xs">
                Chữ ký khách: {insp.customerSignature || 'Chưa ký'}
              </Text>
              <Text variant="secondary" size="xs">
                Chữ ký nhân viên: {insp.staffSignature || 'Đã ký số'}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
