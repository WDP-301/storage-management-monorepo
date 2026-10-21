import { Badge, Button } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { SettlementsApi } from '../../lib/settlements-api';
import type { SettlementDetailRecord } from '../../types/settlement';
import { SettlementApprovalInfo } from './SettlementApprovalInfo';
import { SettlementDecisionForm } from './SettlementDecisionForm';
import { SettlementLinesTable } from './SettlementLinesTable';
import { SettlementOverview } from './SettlementOverview';
import { SettlementRefundForm } from './SettlementRefundForm';
import { describeApiError, SETTLEMENT_STATUS_LABEL } from './settlement-display';

interface Props {
  contractId: string;
  /** Called after an approval or a refund so the page reloads the list. */
  onChanged: () => void;
}

/**
 * Deposit settlement of an ENDED contract (admin and operations only). Loaded from the
 * settlement endpoint when the dialog opens — never from the contract list.
 */
export const ContractSettlementSection: React.FC<Props> = ({ contractId, onChanged }) => {
  const [record, setRecord] = useState<SettlementDetailRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloads, setReloads] = useState(0);

  // `reloads` forces a fresh load of the same contract.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    SettlementsApi.detail(contractId)
      .then((next) => !cancelled && setRecord(next))
      .catch((err: unknown) => {
        if (!cancelled) setError(describeApiError(err, 'Không tải được quyết toán cọc.'));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [contractId, reloads]);

  const reload = () => setReloads((n) => n + 1);
  const changed = (next: SettlementDetailRecord) => {
    setRecord(next);
    onChanged();
  };
  const status = record ? SETTLEMENT_STATUS_LABEL[record.status] : null;

  return (
    <section className="space-y-3 pt-3 border-t border-kumo-line">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-kumo-default">Quyết toán cọc</span>
        {status && <Badge variant={status.variant}>{status.label}</Badge>}
      </div>

      {loading && !record && <p className="text-sm text-kumo-subtle">Đang tải quyết toán…</p>}

      {error && (
        <div
          role="alert"
          className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex items-center gap-2"
        >
          <WarningCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button size="sm" variant="secondary" loading={loading} onClick={reload}>
            Tải lại
          </Button>
        </div>
      )}

      {record && (
        <>
          <SettlementOverview record={record} />
          {record.status === 'PENDING' ? (
            <SettlementDecisionForm
              key={reloads}
              record={record}
              onApproved={changed}
              onStale={reload}
            />
          ) : (
            <>
              <SettlementLinesTable lines={record.lines} totals={record.totals} />
              <SettlementApprovalInfo record={record} />
            </>
          )}
          {record.status === 'AWAITING_REFUND' && (
            <SettlementRefundForm
              key={reloads}
              record={record}
              onCompleted={changed}
              onStale={reload}
            />
          )}
        </>
      )}
    </section>
  );
};
