import { Badge, Button, Dialog, Input, Text } from '@cloudflare/kumo';
import { Copy, Percent, Plus, X } from '@phosphor-icons/react';
import { IPromotionCoupon } from '@storage/types';
import React, { useState } from 'react';

interface PromotionCouponsProps {
  promotions: IPromotionCoupon[];
}

export const PromotionCoupons: React.FC<PromotionCouponsProps> = ({
  promotions: initialPromotions,
}) => {
  const [promos, setPromos] = useState<IPromotionCoupon[]>(initialPromotions);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDiscount, setNewDiscount] = useState(20);
  const [newMinMonths, setNewMinMonths] = useState(3);
  const [newExpiry, setNewExpiry] = useState('2026-12-31');

  const toggleStatus = (id: string) => {
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p)));
  };

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode) return;
    const newCoupon: IPromotionCoupon = {
      id: `promo-${Date.now()}`,
      code: newCode.toUpperCase(),
      description: newDesc,
      discountPercent: newDiscount,
      minRentalMonths: newMinMonths,
      facilityScope: 'Tất cả cơ sở',
      validUntil: newExpiry,
      usageCount: 0,
      isActive: true,
    };
    setPromos([newCoupon, ...promos]);
    setShowAddModal(false);
    setNewCode('');
    setNewDesc('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Khuyến mãi & mã ưu đãi
          </Text>
          <Text variant="secondary" size="sm">
            Chiến dịch kích cầu cho cơ sở có tỷ lệ trống cao hoặc khách hàng mới
          </Text>
        </div>

        <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setShowAddModal(true)}>
          Tạo mã khuyến mãi
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {promos.map((p) => (
          <div
            key={p.id}
            className={`rounded-md border border-kumo-hairline bg-kumo-base p-4 flex flex-col justify-between ${
              p.isActive ? '' : 'opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-kumo-info-tint flex items-center justify-center text-kumo-info shrink-0">
                    <Percent className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold tracking-wide">
                        {p.code}
                      </span>
                      <Button
                        variant="ghost"
                        shape="square"
                        size="xs"
                        icon={<Copy />}
                        aria-label={`Copy mã ${p.code}`}
                        onClick={() => alert(`Đã copy mã: ${p.code}`)}
                      />
                    </div>
                    <Badge variant="primary">Giảm {p.discountPercent}% giá thuê</Badge>
                  </div>
                </div>

                <button type="button" onClick={() => toggleStatus(p.id)} className="cursor-pointer">
                  <Badge variant={p.isActive ? 'success' : 'neutral'} appearance="dot">
                    {p.isActive ? 'Đang chạy' : 'Tạm ngưng'}
                  </Badge>
                </button>
              </div>

              <p className="text-sm text-kumo-default mt-3">{p.description}</p>

              <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-kumo-hairline">
                <div>
                  <p className="text-xs text-kumo-subtle">Áp dụng</p>
                  <p className="text-sm font-semibold text-kumo-strong mt-0.5">{p.facilityScope}</p>
                </div>
                <div>
                  <p className="text-xs text-kumo-subtle">Thuê tối thiểu</p>
                  <p className="text-sm font-semibold text-kumo-strong mt-0.5">
                    {p.minRentalMonths} tháng
                  </p>
                </div>
                <div>
                  <p className="text-xs text-kumo-subtle">Đã dùng</p>
                  <p className="text-sm font-semibold text-kumo-brand mt-0.5">
                    {p.usageCount} lượt
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-kumo-hairline flex items-center justify-between">
              <span className="text-xs text-kumo-subtle">Hạn dùng: {p.validUntil}</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => alert(`Chỉnh sửa voucher ${p.code}`)}
              >
                Cấu hình lại
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create coupon dialog */}
      <Dialog.Root open={showAddModal} onOpenChange={setShowAddModal}>
        <Dialog className="p-6">
          <form onSubmit={handleCreateCoupon}>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-kumo-hairline">
              <Dialog.Title className="text-base font-semibold">Tạo mã khuyến mãi mới</Dialog.Title>
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
                label="Mã coupon"
                required
                placeholder="VÍ DỤ: FLASH50"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="font-mono uppercase"
              />

              <Input
                label="Mô tả ưu đãi"
                required
                placeholder="Giảm 30% cho khách hàng mới..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Giảm giá (%)"
                  type="number"
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(Number(e.target.value))}
                />
                <Input
                  label="Kỳ hạn tối thiểu (tháng)"
                  type="number"
                  value={newMinMonths}
                  onChange={(e) => setNewMinMonths(Number(e.target.value))}
                />
              </div>

              <Input
                label="Ngày hết hạn"
                type="date"
                value={newExpiry}
                onChange={(e) => setNewExpiry(e.target.value)}
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
                Phát hành voucher
              </Button>
            </div>
          </form>
        </Dialog>
      </Dialog.Root>
    </div>
  );
};
