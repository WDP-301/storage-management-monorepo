import { Button, Dialog, Text } from '@cloudflare/kumo';
import { WarningCircle } from '@phosphor-icons/react';
import React, { useState } from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { WarehousesApi } from '../../lib/api';
import { useAppToast } from '../../lib/toast';
import type { Warehouse } from '../../types/warehouse';
import { describeWarehouseError } from './warehouse-display';

interface Props {
  warehouse: Warehouse | null;
  onClose: () => void;
  onDeleted: () => void;
}

export const WarehouseDeleteDialog: React.FC<Props> = ({ warehouse, onClose, onDeleted }) => {
  const toast = useAppToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const close = () => {
    setReason(null);
    onClose();
  };

  const confirm = async () => {
    if (!warehouse) return;
    setIsDeleting(true);
    try {
      await WarehousesApi.remove(warehouse.id);
      toast.notifyDeleted('kho', warehouse.code);
      setReason(null);
      onDeleted();
    } catch (err) {
      const message = describeWarehouseError(err, 'Không thể xóa kho. Vui lòng thử lại.');
      setReason(message);
      toast.error('Không thể xóa kho', message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog.Root open={Boolean(warehouse)} onOpenChange={(open) => !open && close()}>
      <Dialog size="base" className={`${DIALOG_SHELL} max-w-md w-full`}>
        {warehouse && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-kumo-danger-tint flex items-center justify-center shrink-0">
                  <WarningCircle className="w-6 h-6 text-kumo-danger" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-kumo-default">
                    Xóa kho
                  </Dialog.Title>
                  <Text variant="secondary" size="xs">
                    Hành động này không thể hoàn tác.
                  </Text>
                </div>
              </div>
            </DialogHeader>
            <DialogBody>
              <p className="text-xs text-kumo-default">
                Bạn có chắc chắn muốn xóa kho{' '}
                <span className="font-semibold">
                  {warehouse.name} ({warehouse.code})
                </span>{' '}
                không?
              </p>
              {reason && (
                <div
                  role="alert"
                  className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-xs"
                >
                  {reason}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={close} disabled={isDeleting}>
                Hủy bỏ
              </Button>
              <Button variant="destructive" onClick={confirm} loading={isDeleting}>
                Xác nhận xóa
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>
    </Dialog.Root>
  );
};
