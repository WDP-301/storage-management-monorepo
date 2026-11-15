import { ActivityIndicator, ScrollView, View } from 'react-native';
import { colors, Dashed, FlowScreen, InlineMessage } from '../../components/ui';
import { SectionCard } from '../customer/contract-sections';
import { InfoRow } from '../customer/info-row';
import { InspectionEditor } from './InspectionEditor';
import { scheduledLabel } from './inspection-display';
import type { useInspectionDetail } from './use-inspection-detail';

type Props = {
  detail: ReturnType<typeof useInspectionDetail>;
  onBack: () => void;
  onFinalized: () => void;
};

/** Re-check of a vacated unit — the maintenance inspection created on the cancelled old contract. */
export function StaffMaintenanceScreen({ detail, onBack, onFinalized }: Props) {
  const { inspection, error } = detail;
  const finalized = inspection?.finalizedAt != null;

  return (
    <FlowScreen muted onBack={onBack} title="Biên bản bảo trì" titleAlign="left">
      {inspection ? (
        <ScrollView
          className="flex-1 bg-bg-muted"
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SectionCard
            title="Biên bản bảo trì"
            badge={finalized ? 'Đã chốt' : 'Đang lập'}
            tone={finalized ? 'neutral' : 'warning'}
          >
            <InfoRow isNumeric label="Kho cũ" value={inspection.unitCode} />
            <InfoRow label="Chi nhánh" value={inspection.facilityName || '—'} />
            <InfoRow label="Lịch kiểm tra" value={scheduledLabel(inspection)} />
            <InfoRow
              label="Khách hàng"
              value={
                inspection.customerPhone
                  ? `${inspection.customerName} · ${inspection.customerPhone}`
                  : inspection.customerName
              }
            />
            {inspection.contract ? (
              <InfoRow isNumeric label="Hợp đồng cũ" value={inspection.contract.contractNo} />
            ) : null}
            <Dashed />
            <InspectionEditor detail={detail} onFinalized={onFinalized} />
          </SectionCard>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center bg-bg-muted px-6">
          {error ? (
            <InlineMessage message={error} type="error" />
          ) : (
            <ActivityIndicator color={colors.semantic.actionPrimary} />
          )}
        </View>
      )}
    </FlowScreen>
  );
}
