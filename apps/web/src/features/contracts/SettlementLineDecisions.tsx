import { Badge, Input } from '@cloudflare/kumo';
import type React from 'react';
import { SignedFileLink, SignedImageThumb } from '../../components/SignedFile';
import type { SettlementDetailRecord, WaivableLineType } from '../../types/settlement';
import { formatVnd } from '../warehouses/warehouse-display';
import {
  type DamageChoice,
  MAX_REASON_LENGTH,
  type SettlementFormState,
  WAIVABLE_LABEL,
  WAIVABLE_LINES,
} from './settlement-form';

interface Props {
  record: SettlementDetailRecord;
  form: SettlementFormState;
  onChange: (next: SettlementFormState) => void;
  disabled: boolean;
}

const Choice: React.FC<{
  name: string;
  checked: boolean;
  label: string;
  disabled: boolean;
  onSelect: () => void;
}> = ({ name, checked, label, disabled, onSelect }) => (
  <label className="inline-flex items-center gap-1.5 text-sm text-kumo-default cursor-pointer">
    <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onSelect} />
    {label}
  </label>
);

/** Per-line decisions: price or waive each damage, count reviewed payments, waive penalties. */
export const SettlementLineDecisions: React.FC<Props> = ({ record, form, onChange, disabled }) => {
  const setDamage = (index: number, patch: Partial<DamageChoice>) => {
    const current = form.damages[index] ?? { mode: null, amount: '' };
    onChange({ ...form, damages: { ...form.damages, [index]: { ...current, ...patch } } });
  };
  const setWaive = (type: WaivableLineType, patch: { on?: boolean; reason?: string }) => {
    const current = form.waived[type] ?? { on: false, reason: '' };
    onChange({ ...form, waived: { ...form.waived, [type]: { ...current, ...patch } } });
  };
  const credits = record.lines.filter((l) => l.type === 'REVIEW_PAYMENT_CREDIT' && l.payment_id);
  const waivable = record.lines.filter((l) =>
    (WAIVABLE_LINES as readonly string[]).includes(l.type),
  );

  return (
    <div className="space-y-3">
      {record.return.damages.map((damage) => {
        const choice = form.damages[damage.index] ?? { mode: null, amount: '' };
        const name = `damage-${damage.index}`;
        return (
          <div key={damage.index} className="p-3 rounded-lg ring ring-kumo-line space-y-2">
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="text-kumo-default">
                Hư hỏng {damage.index + 1}: {damage.description}
              </span>
              <Badge variant={damage.severity === 'MAJOR' ? 'error' : 'warning'}>
                {damage.severity === 'MAJOR' ? 'Nghiêm trọng' : 'Nhẹ'}
              </Badge>
            </div>
            {damage.evidence.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {damage.evidence.map((file) =>
                  file.mimeType.startsWith('image/') ? (
                    <SignedImageThumb key={file.fileKey} file={file} />
                  ) : (
                    <SignedFileLink key={file.fileKey} file={file} />
                  ),
                )}
              </div>
            )}
            <p className="text-xs text-kumo-subtle">
              {damage.proposed_fee == null
                ? 'Chưa có phí đề xuất — nhập số tiền hoặc chọn Miễn.'
                : `Phí nhân viên đề xuất: ${formatVnd(damage.proposed_fee)} (chỉ để tham khảo).`}
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <Choice
                name={name}
                label="Tính phí"
                checked={choice.mode === 'charge'}
                disabled={disabled}
                onSelect={() => setDamage(damage.index, { mode: 'charge' })}
              />
              <Choice
                name={name}
                label="Miễn"
                checked={choice.mode === 'waive'}
                disabled={disabled}
                onSelect={() => setDamage(damage.index, { mode: 'waive' })}
              />
              {choice.mode === 'charge' && (
                <div className="w-48">
                  <Input
                    label={`Số tiền hư hỏng ${damage.index + 1} (đ)`}
                    type="number"
                    min={0}
                    step={1}
                    value={choice.amount}
                    disabled={disabled}
                    onChange={(e) => setDamage(damage.index, { amount: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {credits.map((line) => {
        const id = line.payment_id as string;
        const include = form.credits[id] ?? null;
        const set = (value: boolean) =>
          onChange({ ...form, credits: { ...form.credits, [id]: value } });
        return (
          <div key={id} className="p-3 rounded-lg ring ring-kumo-line space-y-2 text-sm">
            <div className="text-kumo-default">
              {line.description} · {formatVnd(line.unit_amount)}
            </div>
            <p className="text-xs text-kumo-subtle">
              Tiền khách đã trả cho kỳ không dùng nhưng cần đối chiếu trước khi cộng vào tiền hoàn.
            </p>
            <div className="flex gap-4">
              <Choice
                name={`credit-${id}`}
                label="Tính"
                checked={include === true}
                disabled={disabled}
                onSelect={() => set(true)}
              />
              <Choice
                name={`credit-${id}`}
                label="Không tính"
                checked={include === false}
                disabled={disabled}
                onSelect={() => set(false)}
              />
            </div>
          </div>
        );
      })}

      {waivable.map((line) => {
        const type = line.type as WaivableLineType;
        const choice = form.waived[type] ?? { on: false, reason: '' };
        return (
          <div key={type} className="p-3 rounded-lg ring ring-kumo-line space-y-2 text-sm">
            <div className="text-kumo-default">{line.description}</div>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label={`Miễn ${WAIVABLE_LABEL[type]}`}
                checked={choice.on}
                disabled={disabled}
                onChange={(e) => setWaive(type, { on: e.target.checked })}
              />
              Miễn khoản này
            </label>
            {choice.on && (
              <Input
                label={`Lý do miễn ${WAIVABLE_LABEL[type]}`}
                value={choice.reason}
                maxLength={MAX_REASON_LENGTH}
                disabled={disabled}
                onChange={(e) => setWaive(type, { reason: e.target.value })}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
