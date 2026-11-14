import { Inspection } from '@entities/inspection.entity';
import { StaffShift } from '@entities/staff-shift.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import { isAssignmentActive } from '@modules/auth/role-assignment.util';
import { type InspectionType, StaffShiftStatus, UserRole, UserStatus } from '@storage/types';
import { type EntityManager, In, IsNull, LessThanOrEqual, MoreThan, Not } from 'typeorm';
import { staffOnShiftAt } from './handover-rotation';

/** Shifts the staff member can still be working: not ended by a check-out, absence or cancel. */
const WORKING = [StaffShiftStatus.SCHEDULED, StaffShiftStatus.CHECKED_IN];

export interface RotationMember {
  id: string;
  fullName: string;
}

/** Active staff of the facility in rotation order: by name, then id for equal names. */
export async function facilityStaff(
  em: EntityManager,
  facilityId: string,
): Promise<RotationMember[]> {
  const assignments = await em.find(UserRoleAssignment, {
    where: { facilityId, role: UserRole.FACILITY_STAFF, user: { status: UserStatus.ACTIVE } },
    relations: { user: true },
  });
  const staff = new Map<string, RotationMember>();
  for (const assignment of assignments) {
    if (!isAssignmentActive(assignment) || !assignment.user) continue;
    const { id, fullName } = assignment.user;
    staff.set(id, { id, fullName });
  }
  return [...staff.values()].sort(
    (a, b) => a.fullName.localeCompare(b.fullName, 'vi') || a.id.localeCompare(b.id),
  );
}

/** Which of `staff` have a working shift at the facility covering every one of `times`. */
export async function staffOnShiftFor(
  em: EntityManager,
  facilityId: string,
  staff: readonly RotationMember[],
  times: readonly Date[],
): Promise<Set<string>> {
  if (staff.length === 0 || times.length === 0) return new Set();
  const earliest = new Date(Math.min(...times.map(Number)));
  const latest = new Date(Math.max(...times.map(Number)));
  const shifts = await em.find(StaffShift, {
    where: {
      facilityId,
      staffId: In(staff.map((member) => member.id)),
      status: In(WORKING),
      startAt: LessThanOrEqual(latest),
      endAt: MoreThan(earliest),
    },
  });
  return staffOnShiftAt(shifts, times);
}

/** Staff member of the facility's most recently created inspection of `type` with someone on it. */
export async function lastAssignedStaffId(
  em: EntityManager,
  facilityId: string,
  type: InspectionType,
): Promise<string | null> {
  const last = await em.findOne(Inspection, {
    where: {
      type,
      inspectedBy: Not(IsNull()),
      contract: { bookingItem: { storageUnit: { facilityId } } },
    },
    relations: { contract: { bookingItem: { storageUnit: true } } },
    order: { createdAt: 'DESC', id: 'DESC' },
  });
  return last?.inspectedBy ?? null;
}
