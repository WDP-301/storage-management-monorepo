import type { DamageSeverity } from '@storage/types';
import { Pressable, View } from 'react-native';
import { formatMoney, formatNumber } from '../../../lib/format-vi';
import { Button, Input, TabChip, Text } from '../../components/ui';
import type { StaffDamage } from '../../types/inspection-api';
import { StatusPill } from '../customer/contract-display';
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
  /** Shows the proposed-fee field; only return inspections feed a deposit settlement. */
  withProposedFee?: boolean;
};

export function DamageEditor({
  damages,
  onChange,
  onUploadingChange,
  readOnly,
  withProposedFee = false,
}: Props) {
  const replace = (index: number, patch: Partial<StaffDamage>) =>
    onChange((list) => list.map((damage, i) => (i === index ? { ...damage, ...patch } : damage)));

  if (readOnly && damages.length === 0) {
    return <Text className="text-body text-text-secondary">Không ghi nhận hư hỏng.</Text>;
  }

  return (
    <View className="gap-3">
      {damages.map((damage, index) => (
        <View
          // Damages have no id; the position is their identity while editing.
          key={index}
          className="gap-3 rounded-2xl border border-border-default bg-bg-muted/60 p-3.5"
        >
          {readOnly ? (
            <>
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-body text-text-primary">{damage.description}</Text>
                <StatusPill
                  label={SEVERITY_LABEL[damage.severity]}
                  tone={damage.severity === 'MAJOR' ? 'accent' : 'neutral'}
                />
              </View>
              {withProposedFee ? (
                <Text className="text-body text-text-secondary">
                  {damage.proposedFee === null
                    ? 'Chưa đề xuất phí'
                    : `Phí đề xuất: ${formatMoney(damage.proposedFee)}`}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text className="text-body font-semibold text-text-primary">
                  Hư hỏng {index + 1}
                </Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => onChange((list) => list.filter((_, i) => i !== index))}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-body font-semibold text-status-danger">Xoá</Text>
                </Pressable>
              </View>
              <Input
                maxLength={1000}
                multiline
                onChangeText={(description) => replace(index, { description })}
                placeholder="Mô tả hư hỏng, vị trí…"
                value={damage.description}
              />
              <View className="flex-row gap-2">
                {(['MINOR', 'MAJOR'] as const).map((severity) => (
                  <TabChip
                    key={severity}
                    label={SEVERITY_LABEL[severity]}
                    onPress={() => replace(index, { severity })}
                    selected={damage.severity === severity}
                    tone="primary"
                  />
                ))}
              </View>
              {withProposedFee ? (
                <Input
                  keyboardType="number-pad"
                  label="Phí đề xuất (đ)"
                  maxLength={14}
                  onChangeText={(text) =>
                    replace(index, {
                      proposedFee: parseProposedFee(text, damage.proposedFee),
                    })
                  }
                  placeholder="Để trống nếu chưa đề xuất"
                  value={damage.proposedFee === null ? '' : formatNumber(damage.proposedFee)}
                />
              ) : null}
            </>
          )}
          <EvidenceEditor
            files={damage.evidence ?? []}
            max={MAX_DAMAGE_PHOTOS}
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
            readOnly={readOnly}
          />
        </View>
      ))}
      {readOnly ? null : (
        <Button
          disabled={damages.length >= MAX_DAMAGES}
          label="Thêm hư hỏng"
          leftIcon="add"
          onPress={() =>
            onChange((list) => [
              ...list,
              { description: '', severity: 'MINOR', evidence: [], proposedFee: null },
            ])
          }
          size="sm"
          variant="outline"
        />
      )}
    </View>
  );
}
