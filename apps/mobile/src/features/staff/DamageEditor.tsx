import type { DamageSeverity } from '@storage/types';
import { Button, useThemeColor } from 'heroui-native';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import type { StaffDamage } from '../../types/inspection-api';
import { StatusPill } from '../customer/contract-display';
import { ChipButton } from '../customer/FilterChips';
import { EvidenceEditor } from './EvidenceEditor';
import { parseProposedFee } from './inspection-display';

const MAX_DAMAGES = 20;
const MAX_DAMAGE_PHOTOS = 10;
const SEVERITY_LABEL: Record<DamageSeverity, string> = { MINOR: 'Nhẹ', MAJOR: 'Nghiêm trọng' };

type Props = {
  damages: StaffDamage[];
  /** Takes an updater so edits apply to the latest list, not the one rendered earlier. */
  onChange: (change: (damages: StaffDamage[]) => StaffDamage[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  readOnly?: boolean;
};

export function DamageEditor({ damages, onChange, onUploadingChange, readOnly }: Props) {
  const [mutedColor] = useThemeColor(['muted']);
  const replace = (index: number, patch: Partial<StaffDamage>) =>
    onChange((list) => list.map((damage, i) => (i === index ? { ...damage, ...patch } : damage)));

  if (readOnly && damages.length === 0) {
    return <Text className="font-body text-body-sm text-muted">Không ghi nhận hư hỏng.</Text>;
  }

  return (
    <View className="gap-3">
      {damages.map((damage, index) => (
        <View
          // Damages have no id; the position is their identity while editing.
          key={index}
          className="gap-3 rounded-xl border border-border bg-background p-3"
        >
          {readOnly ? (
            <>
              <View className="flex-row items-start justify-between gap-3">
                <Text className="font-body flex-1 text-body-sm text-foreground">
                  {damage.description}
                </Text>
                <StatusPill
                  label={SEVERITY_LABEL[damage.severity]}
                  tone={damage.severity === 'MAJOR' ? 'accent' : 'neutral'}
                />
              </View>
              <Text className="font-body text-body-sm text-muted">
                {damage.proposedFee === null
                  ? 'Chưa đề xuất phí'
                  : `Phí đề xuất: ${formatMoney(damage.proposedFee)}`}
              </Text>
            </>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text className="text-body-sm font-strong text-foreground">
                  Hư hỏng {index + 1}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => onChange((list) => list.filter((_, i) => i !== index))}
                >
                  <Text className="text-body-sm font-strong text-danger">Xoá</Text>
                </Pressable>
              </View>
              <TextInput
                className="font-body min-h-16 rounded-lg border border-border bg-surface px-3 py-2 text-body-sm text-foreground"
                placeholder="Mô tả hư hỏng, vị trí…"
                placeholderTextColor={mutedColor}
                value={damage.description}
                onChangeText={(description) => replace(index, { description })}
                maxLength={1000}
                multiline
                textAlignVertical="top"
              />
              <View className="flex-row gap-2">
                {(['MINOR', 'MAJOR'] as const).map((severity) => (
                  <ChipButton
                    key={severity}
                    label={SEVERITY_LABEL[severity]}
                    isSelected={damage.severity === severity}
                    onPress={() => replace(index, { severity })}
                  />
                ))}
              </View>
              <View className="gap-1">
                <Text className="font-ui text-caption text-muted">Phí đề xuất (đ)</Text>
                <TextInput
                  className="font-body rounded-lg border border-border bg-surface px-3 py-2 text-body-sm text-foreground"
                  placeholder="Để trống nếu chưa đề xuất"
                  placeholderTextColor={mutedColor}
                  value={damage.proposedFee === null ? '' : formatNumber(damage.proposedFee)}
                  onChangeText={(text) =>
                    replace(index, {
                      proposedFee: parseProposedFee(text, damage.proposedFee),
                    })
                  }
                  keyboardType="number-pad"
                  maxLength={14}
                />
              </View>
            </>
          )}
          <EvidenceEditor
            files={damage.evidence ?? []}
            onAdd={(added) =>
              onChange((list) =>
                list.map((item, i) =>
                  i === index
                    ? {
                        ...item,
                        evidence: [...(item.evidence ?? []), ...added].slice(0, MAX_DAMAGE_PHOTOS),
                      }
                    : item,
                ),
              )
            }
            onRemove={(file) =>
              onChange((list) =>
                list.map((item, i) =>
                  i === index
                    ? {
                        ...item,
                        evidence: (item.evidence ?? []).filter((f) => f.fileKey !== file.fileKey),
                      }
                    : item,
                ),
              )
            }
            onUploadingChange={onUploadingChange}
            max={MAX_DAMAGE_PHOTOS}
            readOnly={readOnly}
          />
        </View>
      ))}
      {readOnly ? null : (
        <Button
          size="sm"
          variant="tertiary"
          className="self-start"
          isDisabled={damages.length >= MAX_DAMAGES}
          onPress={() =>
            onChange((list) => [
              ...list,
              { description: '', severity: 'MINOR', evidence: [], proposedFee: null },
            ])
          }
        >
          <Button.Label>+ Thêm hư hỏng</Button.Label>
        </Button>
      )}
    </View>
  );
}
