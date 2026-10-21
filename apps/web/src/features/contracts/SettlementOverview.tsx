import { Warning } from '@phosphor-icons/react';
import type React from 'react';
import { formatVnDay } from '../../lib/vn-day';
import type { SettlementDetailRecord } from '../../types/settlement';
import { formatVnd } from '../warehouses/warehouse-display';
import { REQUEST_SOURCE_LABEL } from './settlement-display';

function requestSource(record: SettlementDetailRecord): string {
  const { request_source: source, requested_by_name: by } = record.return;
  if (!source) return '—';
  const label = REQUEST_SOURCE_LABEL[source];
  return source !== 'CUSTOMER' && by ? `${label} · ${by}` : label;
}

/** The facts the settlement rests on: deposit, term, return days, notice and overstay. */
export const SettlementOverview: React.FC<{ record: SettlementDetailRecord }> = ({ record }) => {
  const { timing } = record;
  const notice = timing.early
    ? `${timing.notice_days}/${timing.required_notice_days} ngày${
        timing.short_notice ? ' — không đủ' : ''
      }`
    : 'Không trả sớm';
  const overstay =
    timing.overstay_days > 0
      ? `${timing.overstay_days} ngày (từ ${formatVnDay(timing.overstay_from_day)})`
      : 'Không';
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Fact
          label="Tiền cọc"
          value={record.deposit ? formatVnd(record.deposit.amount) : 'Không xác định được cọc'}
        />
        <Fact label="Ngày cuối hợp đồng" value={formatVnDay(timing.last_day)} />
        <Fact label="Ngày hẹn trả" value={formatVnDay(record.return.scheduled_day)} />
        <Fact label="Ngày trả thực tế" value={formatVnDay(record.return.returned_on)} />
        <Fact label="Ngày tính tiền" value={formatVnDay(timing.effective_return_day)} />
        <Fact label="Báo trước" value={notice} />
        <Fact label="Quá hạn" value={overstay} />
        <Fact label="Nguồn yêu cầu" value={requestSource(record)} />
      </dl>
      {record.warnings.length > 0 && (
        <ul className="p-3 bg-kumo-warning-tint rounded-lg text-sm text-kumo-default space-y-1">
          {record.warnings.map((warning) => (
            <li key={warning.code} className="flex gap-2">
              <Warning className="w-4 h-4 shrink-0 mt-0.5 text-kumo-warning" />
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs text-kumo-subtle">{label}</dt>
    <dd className="text-kumo-default">{value}</dd>
  </div>
);
