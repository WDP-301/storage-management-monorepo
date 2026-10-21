import { Text } from 'react-native';
import { isInvoiceDue } from '../../../lib/settlement-format';
import { SectionCard } from './contract-sections';
import { InvoicePayCard } from './InvoicePayCard';
import type { ContractInvoicesState } from './use-contract-invoices';

/** The contract's invoices that still need paying, each with its own QR for what is due. */
export function ContractInvoicesSection({
  state,
  returnScheduledAt,
}: {
  state: ContractInvoicesState;
  returnScheduledAt: string | null;
}) {
  const due = state.invoices.filter(isInvoiceDue);
  const isFirstLoad = state.isLoading && state.invoices.length === 0;
  const badge = isFirstLoad
    ? 'Đang tải'
    : due.length > 0
      ? `${due.length} cần thanh toán`
      : 'Không còn nợ';

  return (
    <SectionCard
      title="Hoá đơn"
      badge={badge}
      tone={due.length > 0 ? 'warning' : isFirstLoad ? 'neutral' : 'success'}
    >
      {state.error ? (
        <Text className="font-body text-body-sm text-danger">{state.error}</Text>
      ) : null}
      {due.map((invoice) => (
        <InvoicePayCard key={invoice.id} invoice={invoice} returnScheduledAt={returnScheduledAt} />
      ))}
      {!isFirstLoad && !state.error && due.length === 0 ? (
        <Text className="font-body text-body-sm text-muted">Không có hoá đơn cần thanh toán.</Text>
      ) : null}
    </SectionCard>
  );
}
