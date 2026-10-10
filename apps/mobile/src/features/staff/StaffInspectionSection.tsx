import { ActivityIndicator, Text } from 'react-native';
import { SectionCard } from '../customer/contract-sections';
import { InspectionEditor } from './InspectionEditor';
import { scheduledLabel } from './inspection-display';
import type { useInspectionDetail } from './use-inspection-detail';

type Props = {
  kind: 'handover' | 'return';
  detail: ReturnType<typeof useInspectionDetail>;
  finalizeBlockedReason?: string;
  onFinalized: () => void;
};

const TITLE = { handover: 'Biên nhận kho', return: 'Biên trả kho' } as const;

/** An inspection the signed-in staff member may edit, inside the same card as the read-only view. */
export function StaffInspectionSection({
  kind,
  detail,
  finalizeBlockedReason,
  onFinalized,
}: Props) {
  const { inspection } = detail;
  const finalized = inspection?.finalizedAt != null;
  return (
    <SectionCard
      title={TITLE[kind]}
      badge={finalized ? 'Đã chốt' : 'Đang lập'}
      tone={finalized ? 'neutral' : 'success'}
    >
      {inspection ? (
        <>
          <Text className="font-body text-body-sm text-muted">{scheduledLabel(inspection)}</Text>
          {inspection.requestNote ? (
            <Text className="font-body text-body-sm leading-5 text-muted">
              Ghi chú của khách: {inspection.requestNote}
            </Text>
          ) : null}
          <InspectionEditor
            detail={detail}
            finalizeBlockedReason={finalizeBlockedReason}
            onFinalized={onFinalized}
          />
        </>
      ) : detail.error ? (
        <Text className="font-body text-body-sm text-danger">{detail.error}</Text>
      ) : (
        <ActivityIndicator />
      )}
    </SectionCard>
  );
}
