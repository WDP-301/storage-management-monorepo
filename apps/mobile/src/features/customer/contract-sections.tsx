import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { formatIsoDate, formatMoney } from '../../../lib/format-vi';
import type { ApiContract, ApiInspection } from '../../types/contract-api';
import {
  contractEndIso,
  contractKindLabel,
  contractStartIso,
  contractStatusLabel,
  contractStatusTone,
  dayOf,
  StatusPill,
  type StatusTone,
} from './contract-display';
import { InfoRow } from './info-row';
import { InspectionBody, type Viewer } from './inspection-body';

export function SectionCard({
  title,
  badge,
  tone,
  children,
}: {
  title: string;
  badge: string;
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <View className="gap-2.5 rounded-xl border border-border bg-surface p-3">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-strong text-body-lg text-foreground">{title}</Text>
        <StatusPill label={badge} tone={tone} />
      </View>
      <View className="h-px bg-separator" />
      {children}
    </View>
  );
}

/** `children` renders last, e.g. the signed-contract files block. */
export function ContractSection({
  contract,
  children,
}: {
  contract: ApiContract;
  children?: ReactNode;
}) {
  return (
    <SectionCard
      title="Hợp đồng"
      badge={contractStatusLabel(contract.status)}
      tone={contractStatusTone(contract.status)}
    >
      <InfoRow isNumeric label="Số hợp đồng" value={contract.contractNo} />
      <InfoRow label="Loại hợp đồng" value={contractKindLabel(contract.kind)} />
      <InfoRow isNumeric label="Ngày hiệu lực" value={formatIsoDate(contractStartIso(contract))} />
      <InfoRow isNumeric label="Ngày kết thúc" value={formatIsoDate(contractEndIso(contract))} />
      <InfoRow label="Kỳ hạn" value={`${contract.months} tháng`} />
      <InfoRow isNumeric label="Tiền thuê" value={`${formatMoney(contract.monthlyPrice)}/tháng`} />
      <InfoRow isNumeric label="Tiền cọc" value={formatMoney(contract.deposit)} />
      {contract.signedAt ? (
        <InfoRow isNumeric label="Ngày ký" value={dayOf(contract.signedAt) ?? ''} />
      ) : null}
      {children ? (
        <View className="gap-2">
          <Text className="font-body text-body-sm text-muted">File hợp đồng đã ký</Text>
          {children}
        </View>
      ) : null}
    </SectionCard>
  );
}

export function HandoverSection({
  handover,
  viewer = 'customer',
}: {
  handover: ApiInspection | null;
  viewer?: Viewer;
}) {
  const received = dayOf(handover?.finalizedAt ?? null);
  return (
    <SectionCard
      title="Biên nhận kho"
      badge={received ? `Đã nhận ${received.slice(0, 5)}` : 'Chưa nhận kho'}
      tone={received ? 'success' : 'neutral'}
    >
      {handover ? (
        <InspectionBody
          inspection={handover}
          scheduledLabel="Ngày hẹn nhận"
          doneLabel="Nhận lúc"
          viewer={viewer}
        />
      ) : (
        <Text className="font-body text-body-sm text-muted">
          {viewer === 'staff' ? 'Chưa có biên nhận.' : 'Biên nhận sẽ có sau khi bạn cọc xong.'}
        </Text>
      )}
    </SectionCard>
  );
}

export function ReturnSection({
  inspection,
  viewer = 'customer',
}: {
  inspection: ApiInspection | null;
  viewer?: Viewer;
}) {
  const returned = dayOf(inspection?.finalizedAt ?? null);
  const scheduled = dayOf(inspection?.scheduledAt ?? null);
  const badge = returned
    ? `Đã trả ${returned.slice(0, 5)}`
    : inspection
      ? `Chờ trả${scheduled ? ` ${scheduled.slice(0, 5)}` : ''}`
      : 'Chưa yêu cầu';
  return (
    <SectionCard
      title="Biên trả kho"
      badge={badge}
      tone={returned ? 'neutral' : inspection ? 'accent' : 'neutral'}
    >
      {inspection ? (
        <InspectionBody
          inspection={inspection}
          scheduledLabel="Ngày hẹn trả"
          doneLabel="Trả lúc"
          viewer={viewer}
        />
      ) : (
        <Text className="font-body text-body-sm text-muted">
          {viewer === 'staff'
            ? 'Chưa có — khách chưa yêu cầu trả kho.'
            : 'Khi muốn dọn đi, bấm "Yêu cầu trả kho" để hẹn ngày với nhân viên.'}
        </Text>
      )}
    </SectionCard>
  );
}
