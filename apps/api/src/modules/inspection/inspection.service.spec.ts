import { AppUser } from '@entities/app-user.entity';
import { Inspection } from '@entities/inspection.entity';
import { UserRoleAssignment } from '@entities/user-role-assignment.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { UserRole } from '@storage/types';
import { Repository } from 'typeorm';
import { InspectionService } from './inspection.service';

const actor = (id: string, roles: UserRole[] = []): AuthUser => ({ id, roles }) as AuthUser;

const activeStaffAssignment = (userId: string): UserRoleAssignment =>
  ({
    id: 'assignment-1',
    userId,
    role: UserRole.FACILITY_STAFF,
    facilityId: 'facility-1',
    startsAt: new Date('2024-01-01T00:00:00Z'),
    endsAt: null,
  }) as UserRoleAssignment;

describe('InspectionService', () => {
  let inspections: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let users: { findOne: jest.Mock };
  let roleAssignments: { find: jest.Mock };
  let service: InspectionService;

  beforeEach(() => {
    inspections = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((inspection) => Promise.resolve(inspection)),
    };
    users = { findOne: jest.fn() };
    roleAssignments = { find: jest.fn() };
    service = new InspectionService(
      inspections as unknown as Repository<Inspection>,
      users as unknown as Repository<AppUser>,
      roleAssignments as unknown as Repository<UserRoleAssignment>,
    );
  });

  it('lists all inspections without scoping, newest first', async () => {
    inspections.find.mockResolvedValue([{ id: 'inspection-1' }]);

    await expect(service.findAll()).resolves.toEqual([{ id: 'inspection-1' }]);
    expect(inspections.find).toHaveBeenCalledWith({
      relations: { contract: true },
      order: { createdAt: 'DESC' },
    });
  });

  it('lists inspections of the customer contracts', async () => {
    inspections.find.mockResolvedValue([{ id: 'inspection-1' }]);

    await expect(service.findMyInspections(actor('customer-1'))).resolves.toEqual([
      { id: 'inspection-1' },
    ]);
    expect(inspections.find).toHaveBeenCalledWith({
      where: { contract: { customerId: 'customer-1' } },
      relations: { contract: true },
      order: { createdAt: 'DESC' },
    });
  });

  it('lists inspections assigned to the staff member', async () => {
    inspections.find.mockResolvedValue([{ id: 'inspection-1' }]);

    await expect(service.findStaffInspections(actor('staff-1'))).resolves.toEqual([
      { id: 'inspection-1' },
    ]);
    expect(inspections.find).toHaveBeenCalledWith({
      where: { inspectedBy: 'staff-1' },
      relations: { contract: true },
      order: { createdAt: 'DESC' },
    });
  });

  it('returns an inspection of the contract owner', async () => {
    inspections.findOne.mockResolvedValue({
      id: 'inspection-1',
      inspectedBy: 'staff-1',
      contract: { id: 'contract-1', customerId: 'customer-1' },
      damages: [],
      finalizedAt: null,
    });

    await expect(service.findById('inspection-1', actor('customer-1'))).resolves.toMatchObject({
      id: 'inspection-1',
    });
    expect(inspections.findOne).toHaveBeenCalledWith({
      where: { id: 'inspection-1' },
      relations: { contract: true },
    });
  });

  it('returns an inspection assigned to the actor', async () => {
    inspections.findOne.mockResolvedValue({
      id: 'inspection-1',
      inspectedBy: 'staff-1',
      contract: { id: 'contract-1', customerId: 'customer-1' },
    });

    await expect(service.findById('inspection-1', actor('staff-1'))).resolves.toMatchObject({
      id: 'inspection-1',
    });
  });

  it('throws 404 for an unknown inspection', async () => {
    inspections.findOne.mockResolvedValue(null);

    await expect(service.findById('missing', actor('staff-1'))).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('throws 403 for a user who is neither owner nor assignee', async () => {
    inspections.findOne.mockResolvedValue({
      id: 'inspection-1',
      inspectedBy: 'staff-1',
      contract: { id: 'contract-1', customerId: 'customer-1' },
    });

    await expect(service.findById('inspection-1', actor('stranger'))).rejects.toMatchObject({
      status: 403,
      response: { code: 'FORBIDDEN' },
    });
  });

  it.each([UserRole.ADMIN, UserRole.OPERATIONS_MANAGER, UserRole.FACILITY_MANAGER])(
    'lets %s view an inspection they do not belong to',
    async (role) => {
      inspections.findOne.mockResolvedValue({
        id: 'inspection-1',
        inspectedBy: 'staff-1',
        contract: { id: 'contract-1', customerId: 'customer-1' },
      });

      await expect(service.findById('inspection-1', actor('boss', [role]))).resolves.toMatchObject({
        id: 'inspection-1',
      });
    },
  );

  it('assigns an active facility staff member', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1' });
    users.findOne.mockResolvedValue({ id: 'staff-1' });
    roleAssignments.find.mockResolvedValue([activeStaffAssignment('staff-1')]);

    await expect(
      service.assignStaff('inspection-1', { inspectedBy: 'staff-1' }),
    ).resolves.toMatchObject({ id: 'inspection-1', inspectedBy: 'staff-1' });
    expect(inspections.save).toHaveBeenCalledWith(
      expect.objectContaining({ inspectedBy: 'staff-1' }),
    );
  });

  it('throws 404 when assigning an unknown inspection', async () => {
    inspections.findOne.mockResolvedValue(null);

    await expect(service.assignStaff('missing', { inspectedBy: 'staff-1' })).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(inspections.save).not.toHaveBeenCalled();
  });

  it('rejects a user who is not facility staff', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1' });
    users.findOne.mockResolvedValue({ id: 'user-1' });
    roleAssignments.find.mockResolvedValue([]);

    await expect(
      service.assignStaff('inspection-1', { inspectedBy: 'user-1' }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        code: 'VALIDATION_FAILED',
        details: { fields: [{ field: 'inspectedBy', code: 'notStaff' }] },
      },
    });
    expect(inspections.save).not.toHaveBeenCalled();
  });

  it('rejects an unknown or inactive user', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1' });
    users.findOne.mockResolvedValue(null);

    await expect(
      service.assignStaff('inspection-1', { inspectedBy: 'ghost' }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        code: 'VALIDATION_FAILED',
        details: { fields: [{ field: 'inspectedBy', code: 'notFound' }] },
      },
    });
    expect(inspections.save).not.toHaveBeenCalled();
  });

  it('lets the assigned inspector update', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1', inspectedBy: 'staff-1' });

    await expect(
      service.update(
        'inspection-1',
        { conditionNotes: 'Scratch on door', damages: [{ item: 'door' }] },
        actor('staff-1', [UserRole.FACILITY_STAFF]),
      ),
    ).resolves.toMatchObject({
      id: 'inspection-1',
      conditionNotes: 'Scratch on door',
      damages: [{ item: 'door' }],
    });
    expect(inspections.save).toHaveBeenCalled();
  });

  it('lets a manager update an inspection assigned to someone else', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1', inspectedBy: 'staff-1' });

    await expect(
      service.update(
        'inspection-1',
        { conditionNotes: 'Checked, no damage' },
        actor('manager-1', [UserRole.FACILITY_MANAGER]),
      ),
    ).resolves.toMatchObject({ id: 'inspection-1', conditionNotes: 'Checked, no damage' });
    expect(inspections.save).toHaveBeenCalled();
  });

  it('rejects update by a staff member who is not the assignee', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1', inspectedBy: 'staff-1' });

    await expect(
      service.update(
        'inspection-1',
        { conditionNotes: 'x' },
        actor('staff-2', [UserRole.FACILITY_STAFF]),
      ),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'FORBIDDEN' },
    });
    expect(inspections.save).not.toHaveBeenCalled();
  });

  it('rejects edits and reassignment once the inspection is finalized', async () => {
    inspections.findOne.mockResolvedValue({
      id: 'inspection-1',
      inspectedBy: 'staff-1',
      finalizedAt: new Date('2026-10-12T09:00:00Z'),
    });
    const manager = actor('manager-1', [UserRole.FACILITY_MANAGER]);

    await expect(
      service.update('inspection-1', { conditionNotes: 'x' }, manager),
    ).rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
    await expect(
      service.assignStaff('inspection-1', { inspectedBy: 'staff-2' }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.uploadEvidence('inspection-1', { evidenceUrl: 'https://x/y.jpg' }, manager),
    ).rejects.toMatchObject({ status: 409 });
    expect(inspections.save).not.toHaveBeenCalled();
  });

  it('throws 404 when updating an unknown inspection', async () => {
    inspections.findOne.mockResolvedValue(null);

    await expect(
      service.update(
        'missing',
        { conditionNotes: 'x' },
        actor('manager-1', [UserRole.OPERATIONS_MANAGER]),
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(inspections.save).not.toHaveBeenCalled();
  });

  it('appends an R2 URL to empty evidence', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1', inspectedBy: 'staff-1' });

    await expect(
      service.uploadEvidence(
        'inspection-1',
        { evidenceUrl: 'https://r2.example.com/uploads/a.jpg' },
        actor('staff-1', [UserRole.FACILITY_STAFF]),
      ),
    ).resolves.toMatchObject({
      id: 'inspection-1',
      evidence: ['https://r2.example.com/uploads/a.jpg'],
    });
    expect(inspections.save).toHaveBeenCalled();
  });

  it('dedupes an already stored URL', async () => {
    inspections.findOne.mockResolvedValue({
      id: 'inspection-1',
      inspectedBy: 'staff-1',
      evidence: ['https://r2.example.com/uploads/a.jpg'],
    });

    await expect(
      service.uploadEvidence(
        'inspection-1',
        { evidenceUrl: 'https://r2.example.com/uploads/a.jpg' },
        actor('manager-1', [UserRole.FACILITY_MANAGER]),
      ),
    ).resolves.toMatchObject({ evidence: ['https://r2.example.com/uploads/a.jpg'] });
  });

  it('rejects evidence upload by a staff member who is not the assignee', async () => {
    inspections.findOne.mockResolvedValue({ id: 'inspection-1', inspectedBy: 'staff-1' });

    await expect(
      service.uploadEvidence(
        'inspection-1',
        { evidenceUrl: 'https://r2.example.com/uploads/a.jpg' },
        actor('staff-2', [UserRole.FACILITY_STAFF]),
      ),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'FORBIDDEN' },
    });
    expect(inspections.save).not.toHaveBeenCalled();
  });

  it('throws 404 when uploading evidence to an unknown inspection', async () => {
    inspections.findOne.mockResolvedValue(null);

    await expect(
      service.uploadEvidence(
        'missing',
        { evidenceUrl: 'https://r2.example.com/uploads/a.jpg' },
        actor('manager-1', [UserRole.OPERATIONS_MANAGER]),
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    expect(inspections.save).not.toHaveBeenCalled();
  });
});
