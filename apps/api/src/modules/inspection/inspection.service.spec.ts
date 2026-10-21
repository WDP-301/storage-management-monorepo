import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { Inspection } from '@entities/inspection.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { addVietnamDays, vietnamToday } from '@shared/utils/calendar.util';
import { ContractStatus, DamageSeverity, InspectionType, UserRole } from '@storage/types';
import { In, IsNull, Not } from 'typeorm';
import { UpdateInspectionDto } from './dto/update-inspection.dto';
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
const CUSTOMER = actor('customer-1', [UserRole.CUSTOMER]);
const ACCOUNT = { bankBin: null, bankName: 'Ngân hàng X', accountNo: '1234', accountName: 'LE B' };
const FEE_DAMAGE = { description: 'Móp cửa', severity: DamageSeverity.MAJOR, proposedFee: 500000 };
/** Noon in Vietnam, `days` from today. */
const inDays = (days: number) => `${addVietnamDays(vietnamToday(), days)}T05:00:00.000Z`;

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
    const settings = {
      getReturnNoticeDays: jest.fn().mockResolvedValue(30),
      getOverduePenaltyPercent: jest.fn().mockResolvedValue(100),
    };
    service = new InspectionService(
      { manager: em, transaction: jest.fn((cb: (e: unknown) => unknown) => cb(em)) } as never,
      settings as never,
    );
  });

  describe('lists', () => {
    it('scopes a facility manager to the facilities they manage, with filters', async () => {
      await service.findAll(MANAGER, { type: InspectionType.RETURN, status: 'open' });

      expect(em.find).toHaveBeenLastCalledWith(Inspection, {
        where: {
          type: InspectionType.RETURN,
          finalizedAt: IsNull(),
          contract: {
            bookingItem: { storageUnit: { facilityId: In(['facility-1']) } },
            status: Not(ContractStatus.CANCELLED),
          },
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

      expect(em.find).toHaveBeenCalledWith(
        Inspection,
        expect.objectContaining({ where: { contract: { status: Not(ContractStatus.CANCELLED) } } }),
      );
    });

    it('hides proposed fees from the customer and the refund account from everyone else', async () => {
      const row = () =>
        buildInspection({
          damages: [FEE_DAMAGE],
          refundAccount: ACCOUNT,
          requestedBy: 'manager-1',
        });
      em.find.mockImplementation(async (entity) =>
        entity === Inspection ? [row()] : assignments.filter((a) => a.userId === 'manager-1'),
      );

      const [mine] = await service.findMyInspections(CUSTOMER);
      expect(mine.damages).toEqual([{ description: 'Móp cửa', severity: DamageSeverity.MAJOR }]);
      expect(mine.refundAccount).toEqual(ACCOUNT);
      expect(mine.requestedBy).toBeUndefined();

      for (const rows of [
        await service.findAll(MANAGER),
        await service.findStaffInspections(STAFF),
      ]) {
        expect(rows[0].damages).toEqual([FEE_DAMAGE]);
        expect(rows[0].refundAccount).toBeUndefined();
        expect(rows[0].requestedBy).toBe('manager-1');
      }
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
      await expect(service.findById('inspection-1', who)).resolves.toMatchObject({
        id: 'inspection-1',
      });
    });

    it('shows the owner their refund account but not the fees nor the staff who asked', async () => {
      inspection = buildInspection({
        damages: [FEE_DAMAGE],
        refundAccount: ACCOUNT,
        requestedBy: 'manager-1',
        requestSource: 'HOTLINE',
      });

      const result = await service.findById('inspection-1', CUSTOMER);

      expect(result.damages).toEqual([{ description: 'Móp cửa', severity: DamageSeverity.MAJOR }]);
      expect(result.refundAccount).toEqual(ACCOUNT);
      expect(result.requestedBy).toBeUndefined();
      expect(result.requestSource).toBe('HOTLINE');
    });

    it.each([
      ['the assigned inspector', STAFF],
      ['a manager of the facility', MANAGER],
      ['operations', OPS],
    ])(
      'shows %s the proposed fees and requester but not the refund account',
      async (_label, who) => {
        inspection = buildInspection({
          damages: [FEE_DAMAGE],
          refundAccount: ACCOUNT,
          requestedBy: 'manager-1',
        });

        const result = await service.findById('inspection-1', who);

        expect(result.damages).toEqual([FEE_DAMAGE]);
        expect(result.refundAccount).toBeUndefined();
        expect(result.requestedBy).toBe('manager-1');
      },
    );

    it('does not look up facilities for a plain customer', async () => {
      await service.findById('inspection-1', CUSTOMER);

      expect(em.find).not.toHaveBeenCalled();
      expect(em.findOne).not.toHaveBeenCalledWith(Contract, expect.anything());
    });

    it('is hidden from another customer', async () => {
      await expect(
        service.findById('inspection-1', actor('customer-2', [UserRole.CUSTOMER])),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('exposes only the inspector name, not their account', async () => {
      inspection = buildInspection({
        inspector: {
          id: 'staff-1',
          fullName: 'Lê Nhân Viên',
          email: 'staff@example.com',
          phone: '0900',
          oauthSubject: 'google-123',
        } as never,
      });

      const result = await service.findById(
        'inspection-1',
        actor('customer-1', [UserRole.CUSTOMER]),
      );

      expect(result.inspector).toEqual({ id: 'staff-1', fullName: 'Lê Nhân Viên' });
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

    it('locks the row so a concurrent finalize cannot be overwritten', async () => {
      await service.update('inspection-1', { conditionNotes: 'OK' }, STAFF);

      expect(em.findOne).toHaveBeenCalledWith(Inspection, {
        where: { id: 'inspection-1' },
        lock: { mode: 'pessimistic_write' },
      });
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

    it('keeps the fee staff propose per damage, and accepts damages without one', async () => {
      const damages = [
        { description: 'Móp cửa', severity: DamageSeverity.MAJOR, proposedFee: 500000 },
        { description: 'Trầy sơn', severity: DamageSeverity.MINOR },
      ];

      await expect(service.update('inspection-1', { damages }, STAFF)).resolves.toMatchObject({
        damages,
      });
    });

    it('never returns the refund account to staff', async () => {
      inspection = buildInspection({ type: InspectionType.RETURN, refundAccount: ACCOUNT });

      const result = await service.update('inspection-1', { conditionNotes: 'OK' }, STAFF);

      expect(result.refundAccount).toBeUndefined();
    });

    describe('rescheduling a return', () => {
      const anchor = new Date('2026-01-01T00:00:00.000Z');
      beforeEach(() => {
        inspection = buildInspection({
          type: InspectionType.RETURN,
          scheduledAt: new Date(inDays(30)),
          noticeFrom: anchor,
          returnRules: { noticeDays: 30, penaltyPercent: 100 },
        });
      });

      it('restarts the customer notice when it moves earlier', async () => {
        const before = Date.now();

        await service.update('inspection-1', { scheduledAt: inDays(5) }, MANAGER);

        const saved = em.save.mock.calls[0][1] as Inspection;
        expect(saved.scheduledAt).toEqual(new Date(inDays(5)));
        expect(saved.noticeFrom?.getTime()).toBeGreaterThanOrEqual(before);
      });

      it('keeps the notice anchor when it moves later', async () => {
        await service.update('inspection-1', { scheduledAt: inDays(60) }, STAFF);

        const saved = em.save.mock.calls[0][1] as Inspection;
        expect(saved.scheduledAt).toEqual(new Date(inDays(60)));
        expect(saved.noticeFrom).toBe(anchor);
      });

      it.each([-1, 366])('rejects a day %d days from today', async (days) => {
        await expect(
          service.update('inspection-1', { scheduledAt: inDays(days) }, STAFF),
        ).rejects.toMatchObject({
          status: 400,
          response: { details: { fields: [{ field: 'scheduledAt', code: 'outOfRange' }] } },
        });
        expect(em.save).not.toHaveBeenCalled();
      });

      it('accepts the appointment sent back unchanged once its day has passed', async () => {
        inspection = buildInspection({
          type: InspectionType.RETURN,
          scheduledAt: new Date(inDays(-3)),
          noticeFrom: anchor,
        });

        await expect(
          service.update(
            'inspection-1',
            // Another time of the same Vietnam day, as a form may send it back.
            {
              scheduledAt: `${addVietnamDays(vietnamToday(), -3)}T12:00:00.000Z`,
              conditionNotes: 'OK',
            },
            STAFF,
          ),
        ).resolves.toMatchObject({ conditionNotes: 'OK' });
        expect((em.save.mock.calls[0][1] as Inspection).noticeFrom).toBe(anchor);
      });

      it('still refuses moving a past appointment to another past day', async () => {
        inspection = buildInspection({
          type: InspectionType.RETURN,
          scheduledAt: new Date(inDays(-3)),
        });

        await expect(
          service.update('inspection-1', { scheduledAt: inDays(-2) }, STAFF),
        ).rejects.toMatchObject({ status: 400 });
      });

      it('accepts a handover appointment sent back unchanged, changing nothing', async () => {
        const scheduledAt = new Date(inDays(-3));
        inspection = buildInspection({ scheduledAt });

        await service.update(
          'inspection-1',
          { scheduledAt: `${addVietnamDays(vietnamToday(), -3)}T12:00:00.000Z` },
          STAFF,
        );

        expect((em.save.mock.calls[0][1] as Inspection).scheduledAt).toBe(scheduledAt);
      });

      it('does not reschedule a handover', async () => {
        inspection = buildInspection();

        await expect(
          service.update('inspection-1', { scheduledAt: inDays(5) }, STAFF),
        ).rejects.toMatchObject({
          status: 400,
          response: { details: { fields: [{ field: 'scheduledAt', code: 'returnOnly' }] } },
        });
      });
    });

    it.each([
      ['a negative fee', -1],
      ['a fraction of a dong', 10.5],
      ['more than a billion', 1_000_000_001],
      ['text', 'free'],
    ])('rejects %s as a proposed fee', async (_label, proposedFee) => {
      await expect(
        createApiValidationPipe().transform(
          { damages: [{ description: 'Móp', severity: 'MAJOR', proposedFee }] },
          { type: 'body', metatype: UpdateInspectionDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    });

    it.each([0, 1_000_000_000, null])('accepts %s as a proposed fee', async (proposedFee) => {
      await expect(
        createApiValidationPipe().transform(
          { damages: [{ description: 'Móp', severity: 'MAJOR', proposedFee }] },
          { type: 'body', metatype: UpdateInspectionDto },
        ),
      ).resolves.toBeDefined();
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
