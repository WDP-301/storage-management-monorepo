import type { EvidenceFile, InspectionDamage } from '../src/types/contract-api';
import type { StaffDamage } from '../src/types/inspection-api';

/** Older rows stored bare URLs; only `{ fileKey }` entries can be presigned and shown. */
export function isEvidenceFile(value: unknown): value is EvidenceFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EvidenceFile).fileKey === 'string'
  );
}

/** Keeps well-formed damage entries and their file evidence. */
export function toDamages(values: readonly unknown[] | null | undefined): InspectionDamage[] {
  return (values ?? []).filter(isDamage).map((damage) => ({
    description: damage.description,
    severity: damage.severity,
    evidence: (damage.evidence ?? []).filter(isEvidenceFile),
  }));
}

/** Staff-only view of the damages: `toDamages` plus the proposed fee, which must be a whole VND amount. */
export function toStaffDamages(values: readonly unknown[] | null | undefined): StaffDamage[] {
  const valid = (values ?? []).filter(isDamage);
  return toDamages(valid).map((damage, index) => ({
    ...damage,
    proposedFee: toProposedFee(
      (valid[index] as { proposedFee?: unknown } | undefined)?.proposedFee,
    ),
  }));
}

function toProposedFee(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function isDamage(value: unknown): value is InspectionDamage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as InspectionDamage).description === 'string'
  );
}
