import { Button } from '@cloudflare/kumo';
import React, { useState } from 'react';

type DepositChoice = 'refund' | 'keep';

const OPTIONS: ReadonlyArray<readonly [DepositChoice, string, string]> = [
  ['refund', 'Hoàn cọc cho khách', 'Ví dụ: lỗi do chi nhánh, khách báo hủy hợp lệ.'],
  [
    'keep',
    'Giữ tiền cọc (khách không đến nhận kho)',
    'Tiền thuê tháng đầu khách đã trả vẫn được hoàn.',
  ],
];

interface Props {
  busy: boolean;
  onBack: () => void;
  onConfirm: (keepDeposit: boolean) => void;
  backLabel?: string;
}

/**
 * Confirms cancelling a DRAFT contract. Whether the deposit goes back is a money decision, so the
 * manager has to pick one explicitly; a unit change's destination has no deposit of its own and
 * the server ignores the choice there.
 */
export const CancelDraftContractConfirm: React.FC<Props> = ({
  busy,
  onBack,
  onConfirm,
  backLabel = 'Quay lại',
}) => {
  const [choice, setChoice] = useState<DepositChoice | null>(null);

  return (
    <div className="w-full p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
      <p className="text-kumo-default">
        Hủy hợp đồng này? Kho sẽ trở về trạng thái trống để cho thuê lại. Không hoàn tác được.
      </p>
      <fieldset className="grid gap-2 text-kumo-default">
        <legend className="text-xs font-medium mb-1">Tiền cọc</legend>
        {OPTIONS.map(([value, label, hint]) => (
          <label key={value} className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="cancel-draft-deposit"
              className="mt-0.5"
              checked={choice === value}
              disabled={busy}
              onChange={() => setChoice(value)}
            />
            <span>
              <span className="font-medium">{label}</span>
              <span className="block text-xs text-kumo-subtle">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onBack}>
          {backLabel}
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabled={choice === null}
          onClick={() => choice && onConfirm(choice === 'keep')}
        >
          Xác nhận hủy hợp đồng
        </Button>
      </div>
    </div>
  );
};
