import type React from 'react';
import type { ContractRecord } from '../../types/contract';
import { formatDateTime, formatDay } from '../inspections/inspection-display';
import { formatVnd } from '../warehouses/warehouse-display';
import { ContractAmenitiesSection } from './ContractAmenitiesSection';
import { CONTRACT_KIND_LABEL, termLastDay } from './contract-display';
import { formatDepositAmount } from './settlement-display';

/**
 * The "Thông tin" tab: facts grouped by what a manager looks for (who, which unit, how long and
 * how much) instead of one flat grid, with the reference numbers set apart at the bottom.
 */
export const ContractInfoPanel: React.FC<{ contract: ContractRecord }> = ({ contract }) => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <FactGroup title="Khách hàng">
        <Fact label="Họ tên" value={contract.customer.full_name ?? 'Khách hàng'} strong />
        <Fact label="Điện thoại" value={contract.customer.phone ?? '—'} />
        <Fact label="Email" value={contract.customer.email ?? '—'} />
      </FactGroup>
      <FactGroup title="Kho thuê">
        <Fact
          label="Kho"
          value={contract.unit ? `${contract.unit.code} · ${contract.unit.name}` : '—'}
          strong
        />
        <Fact label="Địa chỉ" value={contract.unit?.address_line ?? '—'} />
        <Fact label="Loại hợp đồng" value={CONTRACT_KIND_LABEL[contract.kind]} />
      </FactGroup>
    </div>

    <FactGroup title="Thời hạn & chi phí" columns>
      <Fact label="Giá thuê / tháng" value={formatVnd(contract.monthly_price)} strong />
      <Fact label="Tiền cọc" value={formatDepositAmount(contract.deposit)} strong />
      <Fact label="Thời hạn" value={`${contract.months} tháng`} />
      <Fact label="Hiệu lực từ" value={formatDay(contract.effective_at)} />
      <Fact label="Đến hết ngày" value={termLastDay(contract)} />
      <Fact label="Ngày ký" value={formatDay(contract.signed_at)} />
      <Fact label="Ngày kết thúc" value={formatDay(contract.ended_at)} />
    </FactGroup>

    <ContractAmenitiesSection
      amenities={contract.amenities ?? null}
      unitKind={contract.unit?.kind}
    />

    <p className="text-xs text-kumo-subtle">
      Mã đầy đủ <span className="font-mono text-kumo-default">{contract.contract_no}</span>
      {' · '}Tạo lúc {formatDateTime(contract.created_at)}
    </p>
  </div>
);

/** A titled box of facts; `columns` lays a longer group out in a responsive grid. */
const FactGroup: React.FC<{ title: string; columns?: boolean; children: React.ReactNode }> = ({
  title,
  columns,
  children,
}) => (
  <section className="rounded-lg border border-kumo-line p-4">
    <h3 className="mb-3 text-lg font-semibold text-kumo-default">{title}</h3>
    <dl
      className={
        columns ? 'grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4' : 'grid grid-cols-1 gap-y-3'
      }
    >
      {children}
    </dl>
  </section>
);

const Fact: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="min-w-0">
    <dt className="text-sm text-kumo-subtle">{label}</dt>
    <dd
      className={`mt-0.5 text-base text-kumo-default break-words ${strong ? 'font-semibold' : 'font-medium'}`}
    >
      {value}
    </dd>
  </div>
);
