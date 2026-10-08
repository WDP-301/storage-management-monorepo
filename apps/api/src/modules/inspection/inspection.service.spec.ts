import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { DamageSeverity, InspectionType, UserRole } from '@storage/types';
import { In, IsNull } from 'typeorm';
import { InspectionService } from './inspection.service';
import { INSPECTION_RELATIONS } from './inspection-access.util';

const actor = (id: string, roles: UserRole[] = []): AuthUser => ({ id, roles }) as AuthUser;
const STAFF = actor('staff-1', [UserRole.FACILITY_STAFF]);
const MANAGER = actor('manager-1', [UserRole.FACILITY_MANAGER]);
const OPS = actor('ops-1', [UserRole.OPERATIONS_MANAGER]);

const assignment = (userId: string, role: UserRole, facilityId: string) =>
  ({
    userId,
    role,
    facilityId,
    startsAt: new Date('2024-01-01T00:00:00Z'),
    endsAt: null,
  }) as UserRoleAssignment;

const buildInspection = (overrides: Partial<Inspection> = {}): Inspection =>
  ({
    id: 'inspection-1',
    contractId: 'contract-1',
    type: InspectionType.PRE_HANDOVER,
    inspectedBy: 'staff-1',
    contract: { customerId: 'customer-1' },
    evidence: [],
    damages: [],
    ...overrides,
  }) as Inspection;

const PHOTO = { fileKey: 'uploads/1-door.jpg', name: 'door.jpg', mimeType: 'image/jpeg' };

describe('InspectionService', () => {
  let em: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let assignments: UserRoleAssignment[];
  let inspection: Inspection | null;
  let service: InspectionService;

  beforeEach(() => {
    assignments = [assignment('manager-1', UserRole.FACILITY_MANAGER, 'facility-1')];
    inspection = buildInspection();
    em = {
      find: jest.fn(async (entity, options) => {
        if (entity !== UserRoleAssignment) return [];
        const { userId, role } = options.where;
        return assignments.filter((a) => a.userId === userId && a.role === role);
      }),
      findOne: jest.fn(async (entity, options) => {
        if (entity === Inspection) return inspection;
        if (entity === Contract)
          return { bookingItem: { storageUnit: { facilityId: 'facility-1' } } };
        if (entity === AppUser) return options.where.id === 'staff-2' ? { id: 'staff-2' } : null;
        return null;
      }),
      save: jest.fn(async (_entity, data) => data),
    };
    service = new InspectionService({ manager: em } as never);
  });

  describe('lists', () => {
    it('scopes a facility manager to the facilities they manage, with filters', async () => {
      await service.findAll(MANAGER, { type: InspectionType.RETURN, status: 'open' });

      expect(em.find).toHaveBeenLastCalledWith(Inspection, {
        where: {
          type: InspectionType.RETURN,
          finalizedAt: IsNull(),
          contract: { bookingItem: { storageUnit: { facilityId: In(['facility-1']) } } },
        },
        relations: INSPECTION_RELATIONS,
        order: { scheduledAt: { direction: 'ASC', nulls: 'LAST' }, createdAt: 'DESC' },
      });
    });

    it('returns nothing when a manager filters on a facility they do not manage', async () => {
      await expect(service.findAll(MANAGER, { facilityId: 'facility-9' })).resolves.toEqual([]);
      expect(em.find).not.toHaveBeenCalledWith(Inspection, expect.anything());
    });

    it('lets operations see every facility', async () => {
      await service.findAll(OPS);

      expect(em.find).toHaveBeenCalledWith(Inspection, expect.objectContaining({ where: {} }));
    });

    it('lists the staff member’s own inspections', async () => {
      await service.findStaffInspections(STAFF, { status: 'done' });

      expect(em.find).toHaveBeenCalledWith(
        Inspection,
        expect.objectContaining({
          where: expect.objectContaining({ inspectedBy: 'staff-1' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it.each([
      ['the contract owner', actor('customer-1', [UserRole.CUSTOMER])],
      ['the assigned inspector', STAFF],
      ['a manager of the facility', MANAGER],
    ])('is readable by %s', async (_label, who) => {
      await expect(service.findById('inspection-1', who)).resolves.toBe(inspection);
    });

    it('is hidden from a manager of another facility', async () => {
      assignments = [assignment('manager-1', UserRole.FACILITY_MANAGER, 'facility-2')];

      await expect(service.findById('inspection-1', MANAGER)).rejects.toMatchObject({
        status: 403,
      });
    });

    it('throws 404 for an unknown inspection', async () => {
      inspection = null;
      await expect(service.findById('missing', OPS)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('assignStaff', () => {
    it('assigns staff of the same facility', async () => {
      assignments.push(assignment('staff-2', UserRole.FACILITY_STAFF, 'facility-1'));

      await expect(
        service.assignStaff('inspection-1', { inspectedBy: 'staff-2' }, MANAGER),
      ).resolves.toMatchObject({ inspectedBy: 'staff-2' });
    });

    it('rejects staff of another facility', async () => {
      assignments.push(assignment('staff-2', UserRole.FACILITY_STAFF, 'facility-2'));

      await expect(
        service.assignStaff('inspection-1', { inspectedBy: 'staff-2' }, MANAGER),
      ).rejects.toMatchObject({
        response: { details: { fields: [{ field: 'inspectedBy', code: 'notStaff' }] } },
      });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown or inactive user', async () => {
      await expect(
        service.assignStaff('inspection-1', { inspectedBy: 'ghost' }, MANAGER),
      ).rejects.toMatchObject({
        response: { details: { fields: [{ field: 'inspectedBy', code: 'notFound' }] } },
      });
    });

    it('is not open to the inspector or to managers of other facilities', async () => {
      await expect(
        service.assignStaff('inspection-1', { inspectedBy: 'staff-2' }, STAFF),
      ).rejects.toMatchObject({ status: 403 });
      assignments = [assignment('manager-1', UserRole.FACILITY_MANAGER, 'facility-2')];
      await expect(
        service.assignStaff('inspection-1', { inspectedBy: 'staff-2' }, MANAGER),
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('update', () => {
    it('stores typed evidence and damages for the assigned inspector', async () => {
      const damages = [
        { description: 'Móp cửa', severity: DamageSeverity.MINOR, evidence: [PHOTO] },
      ];

      await expect(
        service.update('inspection-1', { conditionNotes: 'OK', evidence: [PHOTO], damages }, STAFF),
      ).resolves.toMatchObject({ conditionNotes: 'OK', evidence: [PHOTO], damages });
    });

    it('rejects staff who are not the assignee', async () => {
      await expect(
        service.update(
          'inspection-1',
          { conditionNotes: 'x' },
          actor('staff-2', [UserRole.FACILITY_STAFF]),
        ),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
      expect(em.save).not.toHaveBeenCalled();
    });

    it('rejects edits and reassignment once the inspection is finalized', async () => {
      inspection = buildInspection({ finalizedAt: new Date('2026-10-12T09:00:00Z') });

      await expect(
        service.update('inspection-1', { conditionNotes: 'x' }, MANAGER),
      ).rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
      await expect(
        service.assignStaff('inspection-1', { inspectedBy: 'staff-2' }, MANAGER),
      ).rejects.toMatchObject({ status: 409 });
      expect(em.save).not.toHaveBeenCalled();
    });
  });
});
