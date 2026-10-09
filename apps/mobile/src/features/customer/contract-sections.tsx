import { Card } from 'heroui-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { formatIsoDate, formatIsoDateTime, formatMoney } from '../../../lib/format-vi';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import type { ApiContract, ApiInspection, InspectionDamage } from '../../types/contract-api';
import {
  contractEndIso,
  contractKindLabel,
  contractStartIso,
  contractStatusLabel,
  contractStatusTone,
  localDayIso,
  StatusPill,
  type StatusTone,
} from './contract-display';

function SectionCard({
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
    <Card className="border border-border bg-surface">
      <Card.Body className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          <StatusPill label={badge} tone={tone} />
        </View>
        {children}
      </Card.Body>
    </Card>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="shrink-0 text-sm text-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const dayOf = (timestamp: string | null) =>
  timestamp ? formatIsoDate(localDayIso(timestamp)) : null;

export function ContractSection({ contract }: { contract: ApiContract }) {
  return (
    <SectionCard
      title="Hợp đồng"
      badge={contractStatusLabel(contract.status)}
      tone={contractStatusTone(contract.status)}
    >
      <InfoRow label="Số hợp đồng" value={contract.contractNo} />
      <InfoRow label="Loại hợp đồng" value={contractKindLabel(contract.kind)} />
      <InfoRow label="Ngày hiệu lực" value={formatIsoDate(contractStartIso(contract))} />
      <InfoRow label="Ngày kết thúc" value={formatIsoDate(contractEndIso(contract))} />
      <InfoRow label="Kỳ hạn" value={`${contract.months} tháng`} />
      <InfoRow label="Tiền thuê" value={`${formatMoney(contract.monthlyPrice)}/tháng`} />
      <InfoRow label="Tiền cọc" value={formatMoney(contract.deposit)} />
      {contract.signedAt ? (
        <InfoRow label="Ngày ký" value={dayOf(contract.signedAt) ?? ''} />
      ) : null}
    </SectionCard>
  );
}

export function HandoverSection({ handover }: { handover: ApiInspection | null }) {
  const received = dayOf(handover?.finalizedAt ?? null);
  return (
    <SectionCard
      title="Biên nhận kho"
      badge={received ? `Đã nhận ${received.slice(0, 5)}` : 'Chưa nhận kho'}
      tone={received ? 'success' : 'neutral'}
    >
      {handover ? (
        <InspectionBody inspection={handover} scheduledLabel="Ngày hẹn nhận" doneLabel="Nhận lúc" />
      ) : (
        <Text className="text-sm text-muted">Biên nhận sẽ có sau khi bạn cọc xong.</Text>
      )}
    </SectionCard>
  );
}

export function ReturnSection({ inspection }: { inspection: ApiInspection | null }) {
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
        <InspectionBody inspection={inspection} scheduledLabel="Ngày hẹn trả" doneLabel="Trả lúc" />
      ) : (
        <Text className="text-sm text-muted">
          Khi muốn dọn đi, bấm "Yêu cầu trả kho" để hẹn ngày với nhân viên.
        </Text>
      )}
    </SectionCard>
  );
}

function InspectionBody({
  inspection,
  scheduledLabel,
  doneLabel,
}: {
  inspection: ApiInspection;
  scheduledLabel: string;
  doneLabel: string;
}) {
  const finalized = inspection.finalizedAt !== null;
  return (
    <>
      {inspection.scheduledAt ? (
        <InfoRow label={scheduledLabel} value={dayOf(inspection.scheduledAt) ?? ''} />
      ) : null}
      {inspection.finalizedAt ? (
        <InfoRow label={doneLabel} value={formatIsoDateTime(inspection.finalizedAt)} />
      ) : null}
      <InfoRow label="Nhân viên phụ trách" value={inspection.inspectorName ?? 'Chưa phân công'} />
      {finalized ? (
        <InfoRow
          label="Hiện trạng"
          value={
            inspection.damages.length > 0 ? `${inspection.damages.length} hư hỏng` : 'Bình thường'
          }
        />
      ) : null}
      {inspection.requestNote ? (
        <Text className="text-sm leading-5 text-foreground">
          Ghi chú của bạn: {inspection.requestNote}
        </Text>
      ) : null}
      {/* Staff notes are a draft until the record is signed off. */}
      {finalized && inspection.conditionNotes ? (
        <Text className="text-sm leading-5 text-muted">{inspection.conditionNotes}</Text>
      ) : null}
      <EvidenceGallery files={inspection.evidence} />
      {inspection.damages.map((damage, index) => (
        <DamageRow key={`${damage.description}-${index}`} damage={damage} />
      ))}
    </>
  );
}

function DamageRow({ damage }: { damage: InspectionDamage }) {
  return (
    <View className="gap-2 rounded-xl border border-border bg-background p-3">
      <View className="flex-row items-start justify-between gap-3">
        <Text className="flex-1 text-sm text-foreground">{damage.description}</Text>
        <StatusPill
          label={damage.severity === 'MAJOR' ? 'Nghiêm trọng' : 'Nhẹ'}
          tone={damage.severity === 'MAJOR' ? 'accent' : 'neutral'}
        />
      </View>
      <EvidenceGallery files={damage.evidence ?? []} />
    </View>
  );
}
