import { Badge, Button, Text } from '@cloudflare/kumo';
import { MapPin, Plus } from '@phosphor-icons/react';
import { IFacility } from '@storage/types';
import React, { useState } from 'react';

interface FacilityMasterProps {
  facilities: IFacility[];
  onSelectFacility: (facility: IFacility) => void;
}

export const FacilityMaster: React.FC<FacilityMasterProps> = ({ facilities, onSelectFacility }) => {
  const [search] = useState('');

  const filtered = facilities.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.city.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Text variant="heading" size="lg" as="h2">
            Danh mục chuỗi cơ sở kho
          </Text>
          <Text variant="secondary" size="sm">
            Thông tin hạ tầng, phân vùng zone, nhân sự phụ trách và quy mô từng chi nhánh
          </Text>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus />}
          onClick={() => alert('Mở form thiết lập chi nhánh cơ sở kho mới vào hệ thống.')}
        >
          Thêm cơ sở mới
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filtered.map((fac) => (
          <div
            key={fac.id}
            className="rounded-md border border-kumo-hairline bg-kumo-base overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="relative h-40 w-full">
                <img src={fac.imageUrl} alt={fac.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3">
                  <Badge variant="neutral">{fac.code}</Badge>
                </div>
                <div className="absolute bottom-3 left-3">
                  <Badge variant="primary">{fac.occupancyRate}% lấp đầy</Badge>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <Text bold size="sm">
                    {fac.name}
                  </Text>
                  <p className="flex items-center gap-1 text-xs text-kumo-subtle mt-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{fac.address}</span>
                  </p>
                </div>

                <div className="p-3 rounded-md bg-kumo-recessed space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-kumo-subtle">Trưởng cơ sở</span>
                    <span className="font-semibold text-kumo-strong">{fac.managerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-kumo-subtle">Hotline hỗ trợ</span>
                    <span className="font-semibold text-kumo-strong">{fac.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-kumo-subtle">Quy mô</span>
                    <span className="font-semibold text-kumo-strong">
                      {fac.occupiedUnits} / {fac.totalUnits} kho
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-kumo-default mb-1.5">
                    Các phân khu chức năng
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {fac.zones.map((z) => (
                      <Badge key={z} variant="purple">
                        {z}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-kumo-default mb-1.5">
                    Tiện ích tiêu chuẩn
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {fac.amenities.slice(0, 4).map((a) => (
                      <Badge key={a} variant="neutral">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 pt-0">
              <Button
                variant="secondary"
                size="base"
                onClick={() => onSelectFacility(fac)}
                className="w-full"
              >
                Truy cập vận hành cơ sở này
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
