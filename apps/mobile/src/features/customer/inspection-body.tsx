import { Text, View } from 'react-native';
import { formatIsoDateTime } from '../../../lib/format-vi';
import { EvidenceGallery } from '../../components/EvidenceGallery';
import type { ApiInspection, InspectionDamage } from '../../types/contract-api';
import { dayOf, StatusPill } from './contract-display';
import { InfoRow } from './info-row';

export type Viewer = 'customer' | 'staff';

export function InspectionBody({
  inspection,
  scheduledLabel,
  doneLabel,
  viewer = 'customer',
}: {
  inspection: ApiInspection;
  scheduledLabel: string;
  doneLabel: string;
  viewer?: Viewer;
}) {
  const finalized = inspection.finalizedAt !== null;
  return (
    <>
      {inspection.scheduledAt ? (
        <InfoRow isNumeric label={scheduledLabel} value={dayOf(inspection.scheduledAt) ?? ''} />
      ) : null}
      {inspection.finalizedAt ? (
        <InfoRow isNumeric label={doneLabel} value={formatIsoDateTime(inspection.finalizedAt)} />
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
        <Text className="font-body text-body-sm leading-5 text-foreground">
          {viewer === 'staff' ? 'Ghi chú của khách' : 'Ghi chú của bạn'}: {inspection.requestNote}
        </Text>
      ) : null}
      {/* Staff notes are a draft until the record is signed off. */}
      {finalized && inspection.conditionNotes ? (
        <Text className="font-body text-body-sm leading-5 text-muted">
          {inspection.conditionNotes}
        </Text>
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
        <Text className="font-body flex-1 text-body-sm text-foreground">{damage.description}</Text>
        <StatusPill
          label={damage.severity === 'MAJOR' ? 'Nghiêm trọng' : 'Nhẹ'}
          tone={damage.severity === 'MAJOR' ? 'accent' : 'neutral'}
        />
      </View>
      <EvidenceGallery files={damage.evidence ?? []} />
    </View>
  );
}
