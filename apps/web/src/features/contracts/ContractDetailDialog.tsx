import { Badge, Button, Dialog, Text } from '@cloudflare/kumo';
import { FileText, PencilSimple, Trash, WarningCircle, X } from '@phosphor-icons/react';
import { UserRole } from '@storage/types';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  DIALOG_SHELL,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from '../../components/dialog-layout';
import { useAuth } from '../../context/AuthContext';
import { ContractsApi, InspectionsApi } from '../../lib/api';
import type { ContractDocument, ContractRecord } from '../../types/contract';
import type { InspectionRecord } from '../../types/inspection';
import { InspectionDetailView } from '../inspections/InspectionDetailView';
import { ContractDocumentsPanel } from './ContractDocumentsPanel';
import { ContractEditDialog } from './ContractEditDialog';
import { ContractInfoPanel } from './ContractInfoPanel';
import { ContractInvoicesSection } from './ContractInvoicesSection';
import { ContractSettlementSection } from './ContractSettlementSection';
import { ContractStaffSection } from './ContractStaffSection';
import { CONTRACT_STATUS_LABEL, shortContractNo } from './contract-display';
import { ManagedReturnForm } from './ManagedReturnForm';

interface Props {
  contract: ContractRecord | null;
  onClose: () => void;
  /** Called after any change so the page reloads the list. */
  onChanged: () => void;
}

type Busy = 'cancel' | 'remove' | 'documents' | null;
type Confirm = 'cancel' | 'remove' | null;

export const ContractDetailDialog: React.FC<Props> = ({ contract, onClose, onChanged }) => {
  const { activeRole } = useAuth();
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState(false);
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoiceRefresh, setInvoiceRefresh] = useState(0);
  const [settlementRefresh, setSettlementRefresh] = useState(0);
  const [tab, setTab] = useState<SectionKey>('info');

  const contractId = contract?.id;
  // The contract on screen; an action that finishes after another one opened must not touch it.
  const shownId = useRef(contractId);
  useEffect(() => {
    shownId.current = contractId;
    setBusy(null);
    setConfirm(null);
    setEditing(false);
    setInspection(null);
    setError(null);
    // A pending settlement is why an ENDED contract gets opened, so it opens on that tab.
    setTab(
      contract?.status === 'ENDED' && contract.settlement_status === 'PENDING'
        ? 'settlement'
        : 'info',
    );
  }, [contractId]);

  if (!contract) return null;
  // Edits and deletes can strand a unit, so they stay with system-wide roles.
  const canManage = activeRole === UserRole.ADMIN || activeRole === UserRole.OPERATIONS_MANAGER;
  const canCancel = canManage || activeRole === UserRole.FACILITY_MANAGER;
  const code = shortContractNo(contract.contract_no);
  const status = CONTRACT_STATUS_LABEL[contract.status];
  const editable = contract.status === 'DRAFT' || contract.status === 'ACTIVE';
  const canEditDocuments = canCancel && editable;
  const removable = contract.status === 'ENDED' || contract.status === 'CANCELLED';

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<unknown>) => {
    const id = contract.id;
    setBusy(kind);
    setError(null);
    try {
      await action();
      if (kind === 'cancel' && shownId.current === id) setInvoiceRefresh((n) => n + 1);
      onChanged();
      if (kind === 'remove' && shownId.current === id) onClose();
    } catch (err) {
      if (shownId.current === id) {
        setError(err instanceof Error ? err.message : 'Thao tác thất bại.');
      }
    } finally {
      if (shownId.current === id) {
        setBusy(null);
        setConfirm(null);
      }
    }
  };

  // The record opens as a step inside this same dialog, with a way back to the contract.
  const openInspection = (id: string) =>
    InspectionsApi.get(id)
      .then(setInspection)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không mở được biên bản.'));

  if (editing) {
    return (
      <ContractEditDialog
        contract={contract}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  const showSettlement = canManage && contract.status === 'ENDED';
  const settlementFirst = showSettlement && contract.settlement_status === 'PENDING';
  const navKeys: SectionKey[] = ['info', 'handover', 'documents'];
  if (canCancel) navKeys.push('invoices');
  if (showSettlement) navKeys.splice(settlementFirst ? 1 : navKeys.length, 0, 'settlement');
  // The remembered tab may not exist for this contract or role (e.g. no settlement tab).
  const activeTab: SectionKey = navKeys.includes(tab) ? tab : 'info';
  const settlement = showSettlement && (
    <TabPanel id="settlement" active={activeTab}>
      <ContractSettlementSection
        key={`settlement-${contract.id}`}
        contractId={contract.id}
        refreshKey={settlementRefresh}
        onChanged={() => {
          setInvoiceRefresh((n) => n + 1);
          onChanged();
        }}
      />
    </TabPanel>
  );

  const hasActions =
    (canCancel && contract.status === 'DRAFT') || (canManage && (removable || editable));

  const saveDocuments = (build: () => Promise<ContractDocument[]>) =>
    run('documents', async () => ContractsApi.replaceDocuments(contract.id, await build()));

  return (
    // Escape (or the backdrop) on an open record steps back to the contract instead of closing.
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (open) return;
        if (inspection) setInspection(null);
        else onClose();
      }}
    >
      <Dialog size="xl" className={`${DIALOG_SHELL} w-[95vw] max-w-[95vw] lg:w-[55vw]`}>
        {inspection && (
          <InspectionDetailView
            inspection={inspection}
            backLabel={`Hợp đồng ${code}`}
            onBack={() => setInspection(null)}
            onClose={onClose}
            onChanged={() => {
              onChanged();
              void openInspection(inspection.id);
            }}
          />
        )}
        {/* Hidden, not unmounted, while a record is open: the tab and any half-filled form
            are still there when the user steps back. `contents` keeps the dialog's column layout. */}
        <div className={inspection ? 'hidden' : 'contents'}>
          <DialogHeader className="flex-col items-stretch gap-3 pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-kumo-fill flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  {/* One dialog title at a time: the open record's title labels the dialog. */}
                  {inspection ? (
                    <span className="text-base font-semibold text-kumo-default">
                      Hợp đồng {code}
                    </span>
                  ) : (
                    <Dialog.Title className="text-base font-semibold text-kumo-default">
                      Hợp đồng {code}
                    </Dialog.Title>
                  )}
                  <Text variant="secondary">{contract.facility?.name ?? ''}</Text>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={status.variant}>{status.label}</Badge>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={onClose}
                  className="p-1.5 rounded-md text-kumo-subtle hover:bg-kumo-control cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <SectionTabs sections={navKeys} active={activeTab} onSelect={setTab} />
          </DialogHeader>

          {/* A fixed floor keeps the frame from jumping as tabs of different length switch. */}
          <DialogBody className="min-h-[60vh]">
            <TabPanel id="info" active={activeTab}>
              <ContractInfoPanel contract={contract} />
            </TabPanel>

            {settlement}

            <TabPanel id="handover" active={activeTab} className="space-y-5">
              <ContractStaffSection
                contract={contract}
                canAssign={canCancel}
                onOpenInspection={openInspection}
                onChanged={onChanged}
              />
              <ManagedReturnForm
                key={`return-${contract.id}`}
                contract={contract}
                canRequest={canCancel}
                onChanged={onChanged}
              />
            </TabPanel>

            <TabPanel id="documents" active={activeTab}>
              <ContractDocumentsPanel
                documents={contract.documents}
                canEdit={canEditDocuments}
                keepOne={contract.status === 'ACTIVE'}
                busy={busy !== null}
                onSave={saveDocuments}
                onInvalid={setError}
              />
            </TabPanel>

            {canCancel && (
              <TabPanel id="invoices" active={activeTab}>
                <ContractInvoicesSection
                  key={`invoices-${contract.id}`}
                  contractId={contract.id}
                  refreshKey={invoiceRefresh}
                  onChanged={() => {
                    setSettlementRefresh((n) => n + 1);
                    onChanged();
                  }}
                />
              </TabPanel>
            )}

            {error && (
              <div
                role="alert"
                className="p-3 bg-kumo-danger-tint text-kumo-danger rounded-lg text-sm flex gap-2"
              >
                <WarningCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </DialogBody>

          {(confirm || hasActions) && (
            <DialogFooter>
              {confirm ? (
                <div className="w-full p-3 bg-kumo-warning-tint rounded-lg space-y-3 text-sm">
                  <p className="text-kumo-default">
                    {confirm === 'cancel'
                      ? 'Hủy hợp đồng này? Kho sẽ trở về trạng thái trống để cho thuê lại. Không hoàn tác được.'
                      : 'Xóa hợp đồng này khỏi danh sách? Không hoàn tác được.'}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => setConfirm(null)}>
                      Quay lại
                    </Button>
                    <Button
                      variant="primary"
                      loading={busy === confirm}
                      onClick={() =>
                        confirm === 'cancel'
                          ? run('cancel', () => ContractsApi.cancel(contract.id))
                          : run('remove', () => ContractsApi.remove(contract.id))
                      }
                    >
                      {confirm === 'cancel' ? 'Xác nhận hủy hợp đồng' : 'Xác nhận xóa'}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {canCancel && contract.status === 'DRAFT' && (
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => setConfirm('cancel')}
                    >
                      Hủy hợp đồng
                    </Button>
                  )}
                  {canManage && removable && (
                    <Button
                      variant="secondary"
                      icon={<Trash className="w-3.5 h-3.5" />}
                      disabled={busy !== null}
                      onClick={() => setConfirm('remove')}
                    >
                      Xóa
                    </Button>
                  )}
                  {canManage && editable && (
                    <Button
                      variant="primary"
                      icon={<PencilSimple className="w-3.5 h-3.5" />}
                      disabled={busy !== null}
                      onClick={() => setEditing(true)}
                    >
                      Sửa hợp đồng
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          )}
        </div>
      </Dialog>
    </Dialog.Root>
  );
};

type SectionKey = 'info' | 'handover' | 'documents' | 'invoices' | 'settlement';

const SECTION_LABEL: Record<SectionKey, string> = {
  info: 'Thông tin',
  handover: 'Nhận / trả kho',
  documents: 'File hợp đồng',
  invoices: 'Hóa đơn',
  settlement: 'Quyết toán cọc',
};

const tabId = (key: SectionKey) => `contract-tab-${key}`;
const panelId = (key: SectionKey) => `contract-panel-${key}`;

/** One tab per part of the contract, so the dialog shows a single topic at a time. */
const SectionTabs: React.FC<{
  sections: SectionKey[];
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
}> = ({ sections, active, onSelect }) => (
  <div
    role="tablist"
    aria-label="Các phần của hợp đồng"
    className="-mb-2 flex gap-1 overflow-x-auto"
  >
    {sections.map((key) => {
      const selected = key === active;
      return (
        <button
          key={key}
          id={tabId(key)}
          type="button"
          role="tab"
          aria-selected={selected}
          aria-controls={panelId(key)}
          onClick={() => onSelect(key)}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium cursor-pointer ${
            selected
              ? 'border-kumo-brand text-kumo-default'
              : 'border-transparent text-kumo-subtle hover:text-kumo-default'
          }`}
        >
          {SECTION_LABEL[key]}
        </button>
      );
    })}
  </div>
);

/**
 * Inactive panels are hidden, not unmounted: a half-filled settlement or payment form keeps
 * its input when the user glances at another tab and comes back.
 */
const TabPanel: React.FC<{
  id: SectionKey;
  active: SectionKey;
  className?: string;
  children: React.ReactNode;
}> = ({ id, active, className, children }) => (
  <div
    id={panelId(id)}
    role="tabpanel"
    aria-labelledby={tabId(id)}
    hidden={id !== active}
    className={className}
  >
    {children}
  </div>
);
