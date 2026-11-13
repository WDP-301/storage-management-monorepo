import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
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
    <View className="flex-1 bg-background">
      <ScreenHeader title="Biên bản bảo trì" backLabel="Hôm nay" onBack={onBack} />
      {inspection ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="px-4 pb-4">
            <SectionCard
              title="Biên bản bảo trì"
              badge={finalized ? 'Đã chốt' : 'Đang lập'}
              tone={finalized ? 'neutral' : 'warning'}
            >
              <InfoRow isNumeric label="Kho cũ" value={inspection.unitCode} />
              <InfoRow label="Chi nhánh" value={inspection.facilityName || '—'} />
              <Text className="font-body text-body-sm text-muted">
                {scheduledLabel(inspection)}
              </Text>
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
              <View className="h-px bg-separator" />
              <InspectionEditor detail={detail} onFinalized={onFinalized} />
            </SectionCard>
          </View>
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          {error ? (
            <Text className="font-body text-center text-body-sm text-danger">{error}</Text>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      )}
    </View>
  );
}
