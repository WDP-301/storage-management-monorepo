import { Text, View } from 'react-native';
import { formatMoney } from '../../../lib/format-vi';
import {
  settlementBadge,
  settlementHeadline,
  settlementLineAmount,
} from '../../../lib/settlement-format';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import type { SettlementLine, SettlementSummaryRecord } from '../../types/contract-api';
import { SectionCard } from './contract-sections';
import { InfoRow } from './info-row';

/** Deposit settlement of an ENDED contract — the server's figures only, the account masked. */
export function SettlementSection({ settlement }: { settlement: SettlementSummaryRecord }) {
  const badge = settlementBadge(settlement.status);
  const { totals, refund_account: account } = settlement;
  const deposit = totals?.deposit_amount ?? settlement.deposit_amount;
  // A payment staff chose not to count changes nothing; listing it would only confuse.
  const lines = settlement.lines.filter((line) => line.included !== false);

  return (
    <SectionCard title="Quyết toán cọc" badge={badge.label} tone={badge.tone}>
      <Text className="font-strong text-body-md text-foreground">
        {settlementHeadline(settlement)}
      </Text>
      {settlement.status === 'PENDING' ? (
        <Text className="font-body text-body-sm leading-5 text-muted">
          Chi nhánh đang đối chiếu biên trả và công nợ. Số tiền hoàn sẽ hiện ở đây sau khi duyệt.
        </Text>
      ) : null}
      <InfoRow
        isNumeric={deposit !== null}
        label="Tiền cọc"
        value={deposit === null ? 'Chưa xác định' : formatMoney(deposit)}
      />
      {lines.map((line, index) => (
        <LineRow key={`${line.type}-${index}`} line={line} />
      ))}
      {totals ? (
        <>
          <View className="h-px bg-separator" />
          <InfoRow isNumeric label="Hoàn lại" value={formatMoney(totals.refund_amount)} />
          {totals.shortfall_amount > 0 ? (
            <>
              <InfoRow
                isNumeric
                label="Còn phải trả"
                value={formatMoney(totals.shortfall_amount)}
              />
              <Text className="font-body text-body-sm leading-5 text-warning">
                Tiền cọc không đủ bù các khoản trên — thanh toán phần còn thiếu ở mục Hoá đơn.
              </Text>
            </>
          ) : null}
        </>
      ) : null}
      {account ? (
        <InfoRow
          isNumeric
          label="Hoàn về"
          value={`${account.bank_name} ${account.account_no_masked} · ${account.account_name}`}
        />
      ) : null}
      <RefundProof settlement={settlement} />
    </SectionCard>
  );
}

function LineRow({ line }: { line: SettlementLine }) {
  return (
    <View className="gap-0.5">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="font-body flex-1 text-body-sm text-foreground">{line.description}</Text>
        <Text
          className={`font-numeric text-num-md ${
            line.waived
              ? 'text-muted'
              : line.direction === 'CREDIT'
                ? 'text-success'
                : 'text-foreground'
          }`}
        >
          {settlementLineAmount(line)}
        </Text>
      </View>
      {line.waived && line.waive_reason ? (
        <Text className="font-body text-caption text-muted">{line.waive_reason}</Text>
      ) : null}
    </View>
  );
}

/** What the branch attached when it confirmed the refund transfer, for the customer to check. */
function RefundProof({ settlement }: { settlement: SettlementSummaryRecord }) {
  const { refund_transfer_ref: transferRef, refund_evidence: evidence } = settlement;
  if (settlement.status !== 'COMPLETED' || (!transferRef && evidence.length === 0)) return null;
  return (
    <View className="gap-2">
      <Text className="font-strong text-body-sm text-foreground">Chứng từ hoàn cọc</Text>
      {transferRef ? <InfoRow isNumeric label="Mã giao dịch" value={transferRef} /> : null}
      {evidence.length > 0 ? <EvidenceGallery files={evidence} /> : null}
    </View>
  );
}
