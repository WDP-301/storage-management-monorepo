import { Button, Card, useThemeColor } from 'heroui-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { formatIsoDate, formatIsoDateTime } from '../../../lib/format-vi';
import { rentalEndIso, toIsoDate } from '../../../lib/rental-schedule';
import type { StaffInspection } from '../../types/inspection-api';
import { StatusPill } from '../customer/contract-display';
import { InfoRow } from '../customer/contract-sections';
import { DamageEditor } from './DamageEditor';
import { EvidenceEditor } from './EvidenceEditor';
import { finalizeConsequence, INSPECTION_KIND_LABEL, scheduledLabel } from './inspection-display';
import type { useInspectionDetail } from './use-inspection-detail';

const MAX_PHOTOS = 20;

type Props = {
  detail: ReturnType<typeof useInspectionDetail>;
  onBack: () => void;
  onFinalized: () => void;
};

export function InspectionDetailScreen({ detail, onBack, onFinalized }: Props) {
  const [mutedColor] = useThemeColor(['muted']);
  const { inspection, form, setForm, error, busy, isDirty, save, finalize } = detail;

  if (!inspection || !form) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        {error ? (
          <Text className="text-center text-sm text-danger">{error}</Text>
        ) : (
          <ActivityIndicator />
        )}
        <Button variant="ghost" className="mt-4" onPress={onBack}>
          <Button.Label>← Quay lại</Button.Label>
        </Button>
      </View>
    );
  }

  const readOnly = inspection.finalizedAt !== null;
  const confirmFinalize = () =>
    Alert.alert('Chốt biên bản?', finalizeConsequence(inspection, form.damages.length), [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Chốt',
        style: 'destructive',
        onPress: async () => {
          if (await finalize()) onFinalized();
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View className="gap-4 px-4 pb-4 pt-5">
        <Button variant="ghost" size="sm" className="self-start" onPress={onBack}>
          <Button.Label>← Hôm nay</Button.Label>
        </Button>
        <Header inspection={inspection} />
        <Section title="Thông tin">
          <InspectionFacts inspection={inspection} />
        </Section>

        <Section title="Ghi chú tình trạng">
          {readOnly ? (
            <Text className="text-sm leading-5 text-foreground">{form.conditionNotes || '—'}</Text>
          ) : (
            <TextInput
              className="min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Tình trạng kho, chìa khoá, đồng hồ điện…"
              placeholderTextColor={mutedColor}
              value={form.conditionNotes}
              onChangeText={(conditionNotes) => setForm({ ...form, conditionNotes })}
              maxLength={5000}
              multiline
              textAlignVertical="top"
            />
          )}
        </Section>

        <Section title="Ảnh hiện trạng">
          <EvidenceEditor
            files={form.evidence}
            onChange={(evidence) => setForm({ ...form, evidence })}
            max={MAX_PHOTOS}
            readOnly={readOnly}
          />
        </Section>

        <Section title="Hư hỏng">
          <DamageEditor
            damages={form.damages}
            onChange={(damages) => setForm({ ...form, damages })}
            readOnly={readOnly}
          />
        </Section>

        {error ? <Text className="text-sm text-danger">{error}</Text> : null}

        {readOnly ? null : (
          <View className="gap-3">
            <Button
              variant="secondary"
              isDisabled={!isDirty || busy !== null}
              onPress={() => void save()}
            >
              <Button.Label>{busy === 'saving' ? 'Đang lưu…' : 'Lưu'}</Button.Label>
            </Button>
            <Button isDisabled={busy !== null} onPress={confirmFinalize}>
              <Button.Label>{busy === 'finalizing' ? 'Đang chốt…' : 'Chốt biên bản'}</Button.Label>
            </Button>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Header({ inspection }: { inspection: StaffInspection }) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="text-2xl font-bold tracking-tight text-foreground">
          {inspection.unitCode}
        </Text>
        <Text className="mt-1 text-sm text-muted">{inspection.facilityName}</Text>
      </View>
      <StatusPill
        label={inspection.finalizedAt ? 'Đã chốt' : INSPECTION_KIND_LABEL[inspection.type]}
        tone={
          inspection.finalizedAt ? 'neutral' : inspection.type === 'RETURN' ? 'accent' : 'success'
        }
      />
    </View>
  );
}

function InspectionFacts({ inspection }: { inspection: StaffInspection }) {
  const contract = inspection.contract;
  const startIso = contract ? toIsoDate(new Date(contract.effectiveAt)) : null;
  return (
    <>
      <InfoRow label="Loại biên bản" value={INSPECTION_KIND_LABEL[inspection.type]} />
      <InfoRow label="Lịch hẹn" value={scheduledLabel(inspection).replace('Hẹn ', '')} />
      <InfoRow label="Khách hàng" value={inspection.customerName} />
      {inspection.customerPhone ? (
        <InfoRow label="Điện thoại" value={inspection.customerPhone} />
      ) : null}
      <InfoRow label="Nhân viên" value={inspection.inspectorName ?? 'Chưa phân công'} />
      {contract && startIso ? (
        <>
          <InfoRow label="Hợp đồng" value={contract.contractNo} />
          <InfoRow
            label="Thời hạn"
            value={`${formatIsoDate(startIso)} → ${formatIsoDate(
              contract.endedAt
                ? toIsoDate(new Date(contract.endedAt))
                : rentalEndIso(startIso, contract.months),
            )}`}
          />
        </>
      ) : null}
      {inspection.finalizedAt ? (
        <InfoRow label="Chốt lúc" value={formatIsoDateTime(inspection.finalizedAt)} />
      ) : null}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="border border-border bg-surface">
      <Card.Body className="gap-3">
        <Text className="text-base font-semibold text-foreground">{title}</Text>
        {children}
      </Card.Body>
    </Card>
  );
}
