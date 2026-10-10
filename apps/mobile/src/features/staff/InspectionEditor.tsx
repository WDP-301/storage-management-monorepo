import { Button, Card, useThemeColor } from 'heroui-native';
import type { ReactNode } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { DamageEditor } from './DamageEditor';
import { EvidenceEditor } from './EvidenceEditor';
import { finalizeConsequence } from './inspection-display';
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
  const [mutedColor] = useThemeColor(['muted']);
  const { inspection, form, updateForm, error, busy, isDirty, isUploading, trackUpload } = detail;
  if (!inspection || !form) return null;

  const readOnly = inspection.finalizedAt !== null;
  const confirmFinalize = () =>
    Alert.alert('Chốt biên bản?', finalizeConsequence(inspection, form.damages.length), [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Chốt',
        style: 'destructive',
        onPress: async () => {
          if (await detail.finalize()) onFinalized();
        },
      },
    ]);

  return (
    <View className="gap-4">
      <Section title="Ghi chú tình trạng">
        {readOnly ? (
          <Text className="font-body text-body-sm leading-5 text-foreground">
            {form.conditionNotes || '—'}
          </Text>
        ) : (
          <TextInput
            className="font-body min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-body-sm text-foreground"
            placeholder="Tình trạng kho, chìa khoá, đồng hồ điện…"
            placeholderTextColor={mutedColor}
            value={form.conditionNotes}
            onChangeText={(conditionNotes) =>
              updateForm((current) => ({ ...current, conditionNotes }))
            }
            maxLength={5000}
            multiline
            textAlignVertical="top"
          />
        )}
      </Section>

      <Section title="Ảnh hiện trạng">
        <EvidenceEditor
          files={form.evidence}
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
          max={MAX_PHOTOS}
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
        />
      </Section>

      {error ? <Text className="font-body text-body-sm text-danger">{error}</Text> : null}

      {readOnly ? null : (
        <View className="gap-3">
          <Button
            variant="secondary"
            isDisabled={!isDirty || busy !== null || isUploading}
            onPress={() => void detail.save()}
          >
            <Button.Label>{busy === 'saving' ? 'Đang lưu…' : 'Lưu'}</Button.Label>
          </Button>
          <Button
            isDisabled={busy !== null || isUploading || Boolean(finalizeBlockedReason)}
            onPress={confirmFinalize}
          >
            <Button.Label>
              {busy === 'finalizing'
                ? 'Đang chốt…'
                : isUploading
                  ? 'Đang tải ảnh…'
                  : 'Chốt biên bản'}
            </Button.Label>
          </Button>
          {finalizeBlockedReason ? (
            <Text className="font-body text-body-sm text-muted">{finalizeBlockedReason}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="border border-border bg-surface">
      <Card.Body className="gap-3">
        <Text className="text-body-lg font-strong text-foreground">{title}</Text>
        {children}
      </Card.Body>
    </Card>
  );
}
