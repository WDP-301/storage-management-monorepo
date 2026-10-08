import type { EvidenceFile, InspectionDamage } from '../src/types/contract-api';

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

function isDamage(value: unknown): value is InspectionDamage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as InspectionDamage).description === 'string'
  );
}
