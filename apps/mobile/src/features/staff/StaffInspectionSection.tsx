import { ActivityIndicator } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { colors, InlineMessage, Text } from '../../components/ui';
import { SectionCard } from '../customer/contract-sections';
import { InspectionEditor } from './InspectionEditor';
import { requestSourceLabel, scheduledLabel } from './inspection-display';
import type { useInspectionDetail } from './use-inspection-detail';

type Props = {
  kind: 'handover' | 'return';
  detail: ReturnType<typeof useInspectionDetail>;
  finalizeBlockedReason?: string;
  onFinalized: () => void;
};

const TITLE = { handover: 'Biên bản nhận kho', return: 'Biên bản trả kho' } as const;

/** An inspection the signed-in staff member may edit, inside the same card as the read-only view. */
export function StaffInspectionSection({
  kind,
  detail,
  finalizeBlockedReason,
  onFinalized,
}: Props) {
  const { inspection } = detail;
  const finalized = inspection?.finalizedAt != null;
  const sourceLabel = inspection ? requestSourceLabel(inspection) : null;
  return (
    <SectionCard
      badge={finalized ? 'Đã chốt' : 'Đang lập'}
      title={TITLE[kind]}
      tone={finalized ? 'neutral' : 'success'}
    >
      {inspection ? (
        <>
          <Text className="text-body text-text-secondary">{scheduledLabel(inspection)}</Text>
          {sourceLabel ? (
            <Text className="text-body text-text-secondary">{sourceLabel}</Text>
          ) : null}
          {inspection.returnedOn ? (
            <Text className="text-body text-text-secondary">
              Ngày chốt trả: {formatIsoDate(inspection.returnedOn)}
            </Text>
          ) : null}
          {inspection.requestNote ? (
            <Text className="text-body leading-5 text-text-secondary">
              {sourceLabel ? 'Ghi chú yêu cầu' : 'Ghi chú của khách'}: {inspection.requestNote}
            </Text>
          ) : null}
          <InspectionEditor
            detail={detail}
            finalizeBlockedReason={finalizeBlockedReason}
            onFinalized={onFinalized}
          />
        </>
      ) : detail.error ? (
        <InlineMessage message={detail.error} type="error" />
      ) : (
        <ActivityIndicator className="py-4" color={colors.semantic.actionPrimary} />
      )}
    </SectionCard>
  );
}
