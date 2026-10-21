import { Badge } from '@cloudflare/kumo';
import type React from 'react';
import type { SettlementLine, SettlementTotals } from '../../types/settlement';
import { formatVnd } from '../warehouses/warehouse-display';
import { formatLineAmount } from './settlement-display';

interface Props {
  lines: SettlementLine[];
  /** null when the deposit cannot be determined: no totals until it is recorded. */
  totals: SettlementTotals | null;
  /** A preview is being recalculated; the figures shown are the previous ones. */
  stale?: boolean;
}

/** Settlement lines and totals exactly as the server computed them. */
export const SettlementLinesTable: React.FC<Props> = ({ lines, totals, stale }) => (
  <div className={`space-y-2 ${stale ? 'opacity-60' : ''}`} aria-busy={stale || undefined}>
    {lines.length === 0 ? (
      <p className="text-sm text-kumo-subtle">Không có khoản cấn trừ hay hoàn thêm nào.</p>
    ) : (
      <ul className="divide-y divide-kumo-line rounded-lg ring ring-kumo-line">
        {lines.map((line, index) => (
          <li
            // Lines have no id; their order is fixed by the server.
            key={`${line.type}-${index}`}
            className="flex items-start justify-between gap-3 p-2.5 text-sm"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="text-kumo-default">{line.description}</div>
              {line.quantity > 1 && (
                <div className="text-xs text-kumo-subtle">
                  {line.quantity} × {formatVnd(line.unit_amount)}
                </div>
              )}
              {line.waived && (
                <div className="text-xs text-kumo-subtle">
                  Miễn{line.waive_reason ? `: ${line.waive_reason}` : ''}
                </div>
              )}
              {line.type === 'REVIEW_PAYMENT_CREDIT' && line.included === false && (
                <div className="text-xs text-kumo-subtle">
                  Không tính ({formatVnd(line.unit_amount)})
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {line.needs_decision && <Badge variant="warning">Chưa quyết định</Badge>}
              <span
                className={`font-medium whitespace-nowrap ${
                  line.direction === 'CREDIT' ? 'text-kumo-success' : 'text-kumo-default'
                }`}
              >
                {formatLineAmount(line)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    )}

    {totals ? (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm p-3 bg-kumo-control rounded-lg">
        <Total label="Tiền cọc" value={formatVnd(totals.deposit_amount)} />
        <Total label="Cộng lại" value={`+${formatVnd(totals.credits_total)}`} />
        <Total label="Cấn trừ" value={`−${formatVnd(totals.deductions_total)}`} />
        {totals.shortfall_amount > 0 ? (
          <Total label="Khách còn thiếu" value={formatVnd(totals.shortfall_amount)} strong />
        ) : (
          <Total label="Hoàn cho khách" value={formatVnd(totals.refund_amount)} strong />
        )}
      </dl>
    ) : (
      <p role="status" className="p-3 bg-kumo-warning-tint rounded-lg text-sm text-kumo-default">
        Không xác định được tiền cọc đã nộp — chưa thể tính số hoàn hay số thiếu.
      </p>
    )}
  </div>
);

const Total: React.FC<{ label: string; value: string; strong?: boolean }> = ({
  label,
  value,
  strong,
}) => (
  <div className="flex items-center justify-between gap-2 col-span-2 sm:col-span-1">
    <dt className="text-kumo-subtle">{label}</dt>
    <dd className={strong ? 'font-semibold text-kumo-default' : 'text-kumo-default'}>{value}</dd>
  </div>
);
