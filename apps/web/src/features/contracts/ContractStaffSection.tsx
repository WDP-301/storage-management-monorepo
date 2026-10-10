import { Button } from '@cloudflare/kumo';
import { ClipboardText } from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { FacilitiesApi, InspectionsApi } from '../../lib/api';
import type { ContractInspectionSummary, ContractRecord } from '../../types/contract';
import type { FacilityStaffMember } from '../../types/inspection';
import { formatDay } from '../inspections/inspection-display';

interface Props {
  contract: ContractRecord;
  /** Admin, operations and facility managers assign staff; the API checks the facility. */
  canAssign: boolean;
  /** Opens the full inspection record (photos, damages, finalize). */
  onOpenInspection: (inspectionId: string) => void;
  onChanged: () => void;
}

const STEP_LABEL = { handover: 'Nhận kho', return: 'Trả kho' } as const;
type Step = keyof typeof STEP_LABEL;

/**
 * Who carries out the contract: the handover and, once requested, the return. Each step is an
 * inspection record staff complete on the app; managers assign them here.
 */
export const ContractStaffSection: React.FC<Props> = ({
  contract,
  canAssign,
  onOpenInspection,
  onChanged,
}) => {
  const [staff, setStaff] = useState<FacilityStaffMember[]>([]);
  const facilityId = contract.facility?.id;
  const open = (['handover', 'return'] as Step[]).some(
    (step) => contract[step] && !contract[step]?.finalized_at,
  );

  useEffect(() => {
    if (!canAssign || !facilityId || !open) return;
    FacilitiesApi.listStaff(facilityId)
      .then(setStaff)
      .catch(() => setStaff([]));
  }, [canAssign, facilityId, open]);

  const steps = (['handover', 'return'] as Step[]).filter((step) => contract[step]);
  return (
    <section className="space-y-1.5">
      <span className="text-xs font-semibold text-kumo-default block">
        Bàn giao & phân công nhân viên
      </span>
      {steps.length === 0 ? (
        <p className="text-sm text-kumo-subtle">Chưa có lượt bàn giao nào.</p>
      ) : (
        <div className="space-y-2">
          {steps.map((step) => (
            <StepRow
              key={step}
              label={STEP_LABEL[step]}
              inspection={contract[step] as ContractInspectionSummary}
              staff={staff}
              canAssign={canAssign}
              onOpen={onOpenInspection}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
};

const StepRow: React.FC<{
  label: string;
  inspection: ContractInspectionSummary;
  staff: FacilityStaffMember[];
  canAssign: boolean;
  onOpen: (id: string) => void;
  onChanged: () => void;
}> = ({ label, inspection, staff, canAssign, onOpen, onChanged }) => {
  const [staffId, setStaffId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = Boolean(inspection.finalized_at);

  const assign = async () => {
    setBusy(true);
    setError(null);
    try {
      await InspectionsApi.assign(inspection.id, staffId);
      setStaffId('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không giao được nhân viên.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 bg-kumo-control rounded-lg space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium text-kumo-default">{label}</span>
          <span className="text-kumo-subtle">
            {' · '}
            {done
              ? `Đã chốt ${formatDay(inspection.finalized_at)}`
              : `Hẹn ${formatDay(inspection.scheduled_at)}`}
          </span>
          <div className={inspection.inspector_name ? 'text-kumo-default' : 'text-kumo-warning'}>
            {inspection.inspector_name ?? 'Chưa giao nhân viên'}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<ClipboardText className="w-3.5 h-3.5" />}
          aria-label={`Xem biên bản ${label.toLowerCase()}`}
          onClick={() => onOpen(inspection.id)}
        >
          Xem biên bản
        </Button>
      </div>
      {canAssign && !done && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            aria-label={`Chọn nhân viên ${label.toLowerCase()}`}
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="flex-1 h-9 px-3 text-sm bg-kumo-base border border-kumo-line rounded-lg"
          >
            <option value="">
              {staff.length > 0 ? '-- Chọn nhân viên --' : 'Cơ sở chưa có nhân viên'}
            </option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName}
                {member.phone ? ` · ${member.phone}` : ''}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={!staffId || busy} loading={busy} onClick={assign}>
            {inspection.inspector_name ? 'Đổi nhân viên' : 'Giao nhân viên'}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-kumo-danger text-xs">
          {error}
        </p>
      )}
    </div>
  );
};
