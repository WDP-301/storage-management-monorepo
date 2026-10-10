import { Button, Dialog, Input, Text } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ContractsApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { ContractRecord } from '../../types/contract';
import {
  buildContractPatch,
  type ContractFormState,
  isSealed,
  shortContractNo,
  toContractForm,
  validateContractForm,
} from './contract-display';

interface Props {
  contract: ContractRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ContractEditDialog: React.FC<Props> = ({ contract, onClose, onSaved }) => {
  const toast = useAppToast();
  const [form, setForm] = useState<ContractFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(contract ? toContractForm(contract) : null);
    setError(null);
  }, [contract]);

  if (!contract || !form) return null;
  const sealed = isSealed(contract);
  const set = (key: keyof ContractFormState, value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateContractForm(form, contract);
    if (problem) {
      setError(problem);
      return;
    }
    const patch = buildContractPatch(form, contract);
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await ContractsApi.update(contract.id, patch);
      toast.notifyUpdated('hợp đồng', shortContractNo(contract.contract_no));
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được hợp đồng.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog size="base" className="p-6 max-w-md w-full">
        <form className="space-y-4" onSubmit={save} noValidate>
          <div>
            <Dialog.Title className="text-base font-semibold text-kumo-default">
              Sửa hợp đồng {shortContractNo(contract.contract_no)}
            </Dialog.Title>
            <Text variant="secondary" size="xs">
              {sealed
                ? 'Hợp đồng đã ký: giá, thời hạn và ngày hiệu lực không đổi được nữa, chỉ sửa ngày kết thúc.'
                : 'Hợp đồng chưa ký: có thể sửa điều khoản trước khi bàn giao kho.'}
            </Text>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ngày hiệu lực"
              type="date"
              value={form.effectiveAt}
              disabled={sealed}
              onChange={(e) => set('effectiveAt', e.target.value)}
            />
            <Input
              label="Thời hạn (tháng)"
              type="number"
              min={1}
              max={60}
              value={form.months}
              disabled={sealed}
              onChange={(e) => set('months', e.target.value)}
            />
            <Input
              label="Giá thuê / tháng (VND)"
              type="number"
              min={0}
              value={form.monthlyPrice}
              disabled={sealed}
              onChange={(e) => set('monthlyPrice', e.target.value)}
            />
            <Input
              label="Ngày kết thúc"
              type="date"
              value={form.endedAt}
              onChange={(e) => set('endedAt', e.target.value)}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-xs flex gap-2"
            >
              <WarningCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-kumo-line">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Hủy bỏ
            </Button>
            <Button type="submit" variant="primary" loading={isSaving}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
};
