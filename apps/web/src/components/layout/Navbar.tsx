import { Badge, Button, Input, Popover, Select, Tabs, Text } from '@cloudflare/kumo';
import {
  Bell,
  MagnifyingGlass,
  Moon,
  Question,
  Shield,
  SlidersHorizontal,
  Sun,
  Warehouse,
  WarningCircle,
} from '@phosphor-icons/react';
import { IFacility, UserRole } from '@storage/types';
import React, { useState } from 'react';

interface NavbarProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  facilities: IFacility[];
  selectedFacility: IFacility;
  onFacilityChange: (facility: IFacility) => void;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  facilities,
  selectedFacility,
  onFacilityChange,
  mode,
  onToggleMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="sticky top-0 z-40 bg-kumo-base border-b border-kumo-hairline px-5 py-2.5">
      <div className="flex items-center justify-between gap-4">
        {/* Brand & Facility Selector */}
        <div className="flex items-center gap-3 min-w-fit">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-kumo-brand flex items-center justify-center text-kumo-inverse">
              <Warehouse className="w-4.5 h-4.5" weight="fill" />
            </div>
            <Text variant="heading" as="span">
              StorageHub
            </Text>
          </div>

          <Select
            aria-label="Chọn cơ sở"
            size="sm"
            className="w-56"
            value={selectedFacility.id}
            onValueChange={(id) => {
              const fac = facilities.find((f) => f.id === id);
              if (fac) onFacilityChange(fac);
            }}
            items={Object.fromEntries(facilities.map((f) => [f.id, f.name]))}
          />
        </div>

        {/* Search */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-2">
          <div className="relative w-full">
            <MagnifyingGlass className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-kumo-placeholder z-10" />
            <Input
              aria-label="Tìm kiếm"
              size="sm"
              placeholder="Tìm unit, hợp đồng, khách thuê..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Role Switcher */}
        <Tabs
          variant="segmented"
          size="sm"
          value={currentRole}
          onValueChange={(val) => onRoleChange(val as UserRole)}
          tabs={[
            {
              value: 'FACILITY_MANAGER',
              label: (
                <span className="flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5" />
                  Cơ sở
                </span>
              ),
            },
            {
              value: 'OPERATIONS_MANAGER',
              label: (
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Toàn chuỗi
                </span>
              ),
            },
            {
              value: 'ADMIN',
              label: (
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </span>
              ),
            },
          ]}
        />

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Badge variant="success" appearance="dot" className="hidden xl:inline-flex">
            Operational
          </Badge>

          <Button
            variant="secondary"
            shape="square"
            size="sm"
            icon={
              mode === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />
            }
            aria-label={mode === 'dark' ? 'Chuyển sang light mode' : 'Chuyển sang dark mode'}
            onClick={onToggleMode}
          />

          <Button
            variant="ghost"
            shape="square"
            size="sm"
            icon={<Question className="w-4 h-4" />}
            aria-label="Trợ giúp"
          />

          <Popover>
            <Popover.Trigger
              render={
                <Button
                  variant="ghost"
                  shape="square"
                  size="sm"
                  icon={<Bell className="w-4 h-4" />}
                  aria-label="Thông báo"
                />
              }
            />
            <Popover.Content className="w-80">
              <div className="flex items-center justify-between">
                <Popover.Title>Thông báo vận hành</Popover.Title>
                <Badge variant="warning">2</Badge>
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-md bg-kumo-warning-tint p-2.5 space-y-0.5">
                  <Text bold size="xs">
                    Unit A-105 quá hạn 21 ngày
                  </Text>
                  <Text variant="secondary" size="xs">
                    Khách Lý Kiến Quốc chưa thanh toán cước tháng 9.
                  </Text>
                </div>
                <div className="rounded-md bg-kumo-info-tint p-2.5 space-y-0.5">
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    <WarningCircle className="w-3.5 h-3.5 text-kumo-info" />1 khách mới trên
                    Waitlist
                  </p>
                  <Text variant="secondary" size="xs">
                    Đã có 1 khách chờ kho mát Climate Controlled Zone C.
                  </Text>
                </div>
              </div>
            </Popover.Content>
          </Popover>

          {/* User */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-kumo-hairline">
            <div className="w-8 h-8 rounded-full bg-kumo-contrast text-kumo-inverse flex items-center justify-center text-xs font-semibold">
              {currentRole === 'ADMIN' ? 'AD' : currentRole === 'OPERATIONS_MANAGER' ? 'OM' : 'FM'}
            </div>
            <div className="hidden lg:block">
              <Text bold size="xs">
                {currentRole === 'ADMIN'
                  ? 'Root Administrator'
                  : currentRole === 'OPERATIONS_MANAGER'
                    ? 'Trần Minh Tâm'
                    : selectedFacility.managerName}
              </Text>
              <Text variant="secondary" size="xs">
                {currentRole === 'ADMIN'
                  ? 'System Admin'
                  : currentRole === 'OPERATIONS_MANAGER'
                    ? 'Head of Operations'
                    : 'Facility Lead'}
              </Text>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
