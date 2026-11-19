import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { type ReactNode, useRef } from 'react';
import { View } from 'react-native';
import { formatIsoDate } from '../../../lib/format-vi';
import { AlertSheet, Button, InlineMessage, Input, Text } from '../../components/ui';
import { DamageEditor } from './DamageEditor';
import { EvidenceEditor } from './EvidenceEditor';
import { finalizeConsequence } from './inspection-display';
import { vietnamDayIso } from './return-dates';
import type { useInspectionDetail } from './use-inspection-detail';

const MAX_PHOTOS = 20;

type Props = {
  detail: ReturnType<typeof useInspectionDetail>;
  /** When set, Finalize is disabled and the reason is shown under the buttons. */
  finalizeBlockedReason?: string;
  onFinalized: () => void;
};

/** Condition notes, photos, damages and Save/Finalize for one inspection (handover or return). */
export function InspectionEditor({ detail, finalizeBlockedReason, onFinalized }: Props) {
  const { inspection, form, updateForm, error, busy, isDirty, isUploading, trackUpload } = detail;
  const finalizeSheetRef = useRef<BottomSheetModal>(null);
  if (!inspection || !form) return null;

  const readOnly = inspection.finalizedAt !== null;
  const isReturn = inspection.type === 'RETURN';
  const consequence = finalizeConsequence(inspection, form.damages);
  const today = formatIsoDate(vietnamDayIso(new Date()));
  // A return is recorded on the day it is finalized; staff see that day before confirming.
  const finalizeMessage = isReturn
    ? `${consequence}\n\nNgày trả ghi nhận là hôm nay (${today}) — tiền thuê, trả trước hạn (mất cọc) và phí quá hạn tính theo ngày này.`
    : consequence;

  return (
    <View className="gap-3.5">
      <Section title="Ghi chú tình trạng">
        {readOnly ? (
          <Text className="text-body leading-5 text-text-primary">
            {form.conditionNotes || '—'}
          </Text>
        ) : (
          <Input
            maxLength={5000}
            multiline
            onChangeText={(conditionNotes) =>
              updateForm((current) => ({ ...current, conditionNotes }))
            }
            placeholder="Tình trạng kho, chìa khoá, đồng hồ điện…"
            value={form.conditionNotes}
          />
        )}
      </Section>

      <Section title="Ảnh hiện trạng">
        <EvidenceEditor
          files={form.evidence}
          max={MAX_PHOTOS}
          onAdd={(added) =>
            updateForm((current) => ({
              ...current,
              evidence: [...current.evidence, ...added].slice(0, MAX_PHOTOS),
            }))
          }
          onRemove={(file) =>
            updateForm((current) => ({
              ...current,
              evidence: current.evidence.filter((f) => f.fileKey !== file.fileKey),
            }))
          }
          onUploadingChange={trackUpload}
          readOnly={readOnly}
        />
      </Section>

      <Section title="Hư hỏng">
        <DamageEditor
          damages={form.damages}
          onChange={(change) =>
            updateForm((current) => ({ ...current, damages: change(current.damages) }))
          }
          onUploadingChange={trackUpload}
          readOnly={readOnly}
          // Fees are only proposed when the unit comes back, for the deposit settlement.
          withProposedFee={isReturn}
        />
      </Section>

      {error ? <InlineMessage message={error} type="error" /> : null}

      {readOnly ? null : (
        <View className="gap-2.5">
          <Button
            disabled={!isDirty || busy !== null || isUploading}
            fullWidth
            label={busy === 'saving' ? 'Đang lưu…' : 'Lưu'}
            loading={busy === 'saving'}
            onPress={() => void detail.save()}
            variant="secondary"
          />
          <Button
            disabled={busy !== null || isUploading || Boolean(finalizeBlockedReason)}
            fullWidth
            label={
              busy === 'finalizing' ? 'Đang chốt…' : isUploading ? 'Đang tải ảnh…' : 'Chốt biên bản'
            }
            loading={busy === 'finalizing'}
            onPress={() => finalizeSheetRef.current?.present()}
          />
          {finalizeBlockedReason ? (
            <InlineMessage message={finalizeBlockedReason} type="warning" />
          ) : null}
        </View>
      )}

      <AlertSheet
        actionsLayout="row"
        destructive
        message={finalizeMessage}
        onPrimary={async () => {
          if (await detail.finalize()) onFinalized();
        }}
        primaryLabel="Chốt"
        ref={finalizeSheetRef}
        secondaryLabel="Huỷ"
        title={isReturn ? 'Chốt biên bản trả kho?' : 'Chốt biên bản?'}
      />
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-[20px] border border-border-default bg-bg-card p-4">
      <Text className="text-body-lg font-semibold text-text-primary">{title}</Text>
      {children}
    </View>
  );
}
