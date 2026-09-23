import { Banner, Button, Input, Text } from '@cloudflare/kumo';
import { CheckCircle, Clock, Coins, FloppyDisk } from '@phosphor-icons/react';
import React, { useState } from 'react';

export const PricingPolicies: React.FC = () => {
  const [lateFeePercentPerDay, setLateFeePercentPerDay] = useState(2.5);
  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [lockAccessDays, setLockAccessDays] = useState(7);
  const [depositRefundNoticeDays, setDepositRefundNoticeDays] = useState(15);
  const [cleaningDeductionStandard, setCleaningDeductionStandard] = useState(200000);
  const [overtimeAccessFeePerHour, setOvertimeAccessFeePerHour] = useState(50000);

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePolicies = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <form onSubmit={handleSavePolicies} className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Chính sách phí phạt, grace period & biểu phí
          </Text>
          <Text variant="secondary" size="sm">
            Tham số tự động: tính phạt quá hạn, khóa quyền truy cập và thời hạn ân hạn
          </Text>
        </div>

        <Button variant="primary" size="sm" type="submit" icon={<FloppyDisk />}>
          Lưu cấu hình chính sách
        </Button>
      </div>

      {savedSuccess && (
        <Banner
          variant="default"
          size="sm"
          icon={<CheckCircle />}
          title="Đã lưu chính sách mới vào toàn hệ thống"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue & late policies */}
        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-kumo-hairline">
            <Clock className="w-4 h-4 text-kumo-danger" />
            <Text bold size="sm">
              Quy định quá hạn & chế tài vi phạm
            </Text>
          </div>

          <Input
            label="Thời gian ân hạn không tính phạt (ngày)"
            type="number"
            value={gracePeriodDays}
            onChange={(e) => setGracePeriodDays(Number(e.target.value))}
            description="Trong thời gian này khách chỉ nhận tin nhắn nhắc nhở qua SMS/App"
          />

          <Input
            label="Phí phạt chậm nộp tiền thuê (% / ngày)"
            type="number"
            step="0.1"
            value={lateFeePercentPerDay}
            onChange={(e) => setLateFeePercentPerDay(Number(e.target.value))}
            description="Tính trên số tiền trễ hạn"
          />

          <Input
            label="Ngưỡng khóa thẻ từ / mã PIN (ngày sau hạn)"
            type="number"
            value={lockAccessDays}
            onChange={(e) => setLockAccessDays(Number(e.target.value))}
            description="Hệ thống tự động vô hiệu hóa mã QR và thẻ từ khi vượt ngưỡng"
          />
        </div>

        {/* Cancellation & refund policies */}
        <div className="rounded-md border border-kumo-hairline bg-kumo-base p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-kumo-hairline">
            <Coins className="w-4 h-4 text-kumo-success" />
            <Text bold size="sm">
              Chính sách hủy & hoàn tiền cọc
            </Text>
          </div>

          <Input
            label="Báo trước để hoàn 100% cọc (ngày)"
            type="number"
            value={depositRefundNoticeDays}
            onChange={(e) => setDepositRefundNoticeDays(Number(e.target.value))}
            description="Báo trễ hơn quy định sẽ trừ 50% tiền đặt cọc giữ chỗ"
          />

          <Input
            label="Phí dọn vệ sinh nếu unit bẩn khi trả (₫)"
            type="number"
            value={cleaningDeductionStandard}
            onChange={(e) => setCleaningDeductionStandard(Number(e.target.value))}
            description="Cấn trừ vào tiền hoàn cọc khi biên bản nghiệm thu < 3/5"
          />

          <Input
            label="Phí phụ thu mở cửa ngoài giờ (₫/giờ)"
            type="number"
            value={overtimeAccessFeePerHour}
            onChange={(e) => setOvertimeAccessFeePerHour(Number(e.target.value))}
          />
        </div>
      </div>
    </form>
  );
};
