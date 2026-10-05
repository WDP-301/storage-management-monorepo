import { ServiceTicket } from '@entities/service-ticket.entity';
import type { AuthUser } from '@modules/auth/types/auth-user';
import { hashBody } from '@shared/utils/canonical-json.util';
import {
  ContractStatus,
  IdempotencyStatus,
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from '@storage/types';
import { QueryFailedError } from 'typeorm';
import { ServiceTicketsService } from './service-tickets.service';

const buildActor = (overrides: Partial<AuthUser> = {}): AuthUser =>
  ({
    id: 'actor-1',
    email: 'actor@example.com',
    phone: null,
    fullName: 'Actor',
    status: UserStatus.ACTIVE,
    roles: [UserRole.CUSTOMER],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  }) as AuthUser;

const buildTicket = (overrides: Partial<ServiceTicket> = {}): ServiceTicket =>
  ({
    id: 'ticket-1',
    ticketNo: 'ST-20260101-ABCD1234',
    typeId: 'type-1',
    facilityId: 'facility-1',
    storageUnitId: undefined,
    customerId: 'customer-1',
    assignedTo: undefined,
    priority: TicketPriority.NORMAL,
    status: TicketStatus.OPEN,
    subject: 'Broken lock',
    description: 'The lock is not working.',
    resolution: undefined,
    history: [],
    attachments: [],
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    resolvedAt: undefined,
    type: { id: 'type-1', code: 'SUPPORT', name: 'Customer Support' },
    facility: { id: 'facility-1', code: 'F001', name: 'Facility One' },
    storageUnit: undefined,
    customer: { id: 'customer-1', email: 'c@example.com', fullName: 'Customer One' },
    assignee: undefined,
    ...overrides,
  }) as ServiceTicket;

const buildManagerAssignment = (facilityId: string) => ({
  id: 'assignment-manager',
  userId: 'actor-1',
  role: UserRole.FACILITY_MANAGER,
  facilityId,
  startsAt: new Date('2024-01-01T00:00:00Z'),
  endsAt: undefined,
  createdAt: new Date('2024-01-01T00:00:00Z'),
});

const buildStaffAssignment = (facilityId: string) => ({
  id: 'assignment-staff',
  userId: 'staff-1',
  role: UserRole.FACILITY_STAFF,
  facilityId,
  startsAt: new Date('2024-01-01T00:00:00Z'),
  endsAt: undefined,
  createdAt: new Date('2024-01-01T00:00:00Z'),
});

const buildQueryBuilder = (rows: ServiceTicket[], total: number) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
});

const buildRentCheckBuilder = (exists: boolean) => ({
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getExists: jest.fn().mockResolvedValue(exists),
});

describe('ServiceTicketsService', () => {
  let tickets: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let ticketTypes: { findOne: jest.Mock };
  let roleAssignments: { find: jest.Mock; findOne: jest.Mock };
  let users: { findOne: jest.Mock };
  let facilities: { findOne: jest.Mock };
  let storageUnits: { findOne: jest.Mock };
  let contracts: { createQueryBuilder: jest.Mock };
  let idempotencyKeys: { query: jest.Mock; delete: jest.Mock };
  let em: { save: jest.Mock; findOneOrFail: jest.Mock; update: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let service: ServiceTicketsService;

  beforeEach(() => {
    tickets = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    ticketTypes = { findOne: jest.fn().mockResolvedValue(null) };
    roleAssignments = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    users = { findOne: jest.fn().mockResolvedValue(null) };
    facilities = { findOne: jest.fn().mockResolvedValue(null) };
    storageUnits = { findOne: jest.fn().mockResolvedValue(null) };
    contracts = {
      createQueryBuilder: jest.fn(() => buildRentCheckBuilder(true)),
    };
    idempotencyKeys = {
      query: jest.fn().mockResolvedValue([{ is_new_insert: true }]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    em = {
      save: jest.fn((value) => Promise.resolve(value)),
      findOneOrFail: jest.fn().mockResolvedValue(buildTicket()),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    dataSource = { transaction: jest.fn((cb: (manager: typeof em) => unknown) => cb(em)) };

    service = new ServiceTicketsService(
      tickets as never,
      ticketTypes as never,
      roleAssignments as never,
      users as never,
      facilities as never,
      storageUnits as never,
      contracts as never,
      idempotencyKeys as never,
      dataSource as never,
    );
  });

  describe('create', () => {
    const dto = {
      facilityId: 'facility-1',
      typeId: 'type-1',
      subject: '  Broken lock  ',
      description: 'The lock is not working.',
    };

    it('creates the ticket owned by the session user with no assignee', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      const fullTicket = buildTicket({ customerId: 'customer-1' });
      em.findOneOrFail.mockResolvedValue(fullTicket);

      const result = await service.create(dto, buildActor({ id: 'customer-1' }), 'key-1');

      expect(tickets.create).toHaveBeenCalledWith(
        expect.objectContaining({
          facilityId: 'facility-1',
          typeId: 'type-1',
          customerId: 'customer-1',
          subject: 'Broken lock',
          status: TicketStatus.OPEN,
        }),
      );
      expect(tickets.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ assignedTo: expect.anything() }),
      );
      expect(em.save).toHaveBeenCalled();
      expect(result.isRetry).toBe(false);
      expect(result.data.ticket.ticket_no).toMatch(/^ST-\d{8}-[0-9A-F]{8}$/);
      expect(result.data.ticket.customer_id).toBe('customer-1');
      expect(result.data.ticket.assigned_to).toBeNull();
    });

    it('marks the idempotency key DONE with the created ticket inside the transaction', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });

      await service.create(dto, buildActor({ id: 'customer-1' }), 'key-1');

      expect(em.update).toHaveBeenCalledWith(
        expect.anything(),
        { key: 'key-1', userId: 'customer-1' },
        expect.objectContaining({ status: IdempotencyStatus.DONE }),
      );
    });

    it('returns the cached response on a retry with the same key and payload', async () => {
      const cached = { ticket: buildTicket({ customerId: 'customer-1' }) };
      idempotencyKeys.query.mockResolvedValue([
        {
          is_new_insert: false,
          request_hash: hashBody(dto),
          status: IdempotencyStatus.DONE,
          response_body: cached,
        },
      ]);

      const result = await service.create(dto, buildActor({ id: 'customer-1' }), 'key-1');

      expect(result.isRetry).toBe(true);
      expect(result.data).toEqual(cached);
      expect(tickets.create).not.toHaveBeenCalled();
    });

    it('rejects a retry that reuses the key with a different payload', async () => {
      idempotencyKeys.query.mockResolvedValue([
        {
          is_new_insert: false,
          request_hash: 'stale-hash',
          status: IdempotencyStatus.DONE,
        },
      ]);

      await expect(
        service.create(dto, buildActor({ id: 'customer-1' }), 'key-1'),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' },
      });
      expect(tickets.create).not.toHaveBeenCalled();
    });

    it('rejects while another request holds the key in PROCESSING', async () => {
      idempotencyKeys.query.mockResolvedValue([
        {
          is_new_insert: false,
          request_hash: hashBody(dto),
          status: IdempotencyStatus.PROCESSING,
          created_at: new Date().toISOString(),
        },
      ]);

      await expect(
        service.create(dto, buildActor({ id: 'customer-1' }), 'key-1'),
      ).rejects.toMatchObject({ status: 409, response: { code: 'IDEMPOTENCY_KEY_CONFLICT' } });
      expect(tickets.create).not.toHaveBeenCalled();
    });

    it('reclaims a stale PROCESSING key and creates the ticket', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      idempotencyKeys.query
        .mockResolvedValueOnce([
          {
            is_new_insert: false,
            request_hash: hashBody(dto),
            status: IdempotencyStatus.PROCESSING,
            created_at: new Date(Date.now() - 120_000).toISOString(),
          },
        ])
        .mockResolvedValueOnce([{ is_new_insert: true }]);

      const result = await service.create(dto, buildActor({ id: 'customer-1' }), 'key-1');

      expect(idempotencyKeys.query).toHaveBeenCalledTimes(2);
      expect(result.isRetry).toBe(false);
      expect(em.save).toHaveBeenCalled();
    });

    it('releases the claimed key when validation fails', async () => {
      facilities.findOne.mockResolvedValue(null);

      await expect(
        service.create(dto, buildActor({ id: 'customer-1' }), 'key-1'),
      ).rejects.toMatchObject({ status: 400 });

      expect(idempotencyKeys.delete).toHaveBeenCalledWith({
        key: 'key-1',
        userId: 'customer-1',
      });
    });

    it('rejects an unknown facility', async () => {
      facilities.findOne.mockResolvedValue(null);

      await expect(service.create(dto, buildActor(), 'key-1')).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'facilityId', code: 'notFound' }] },
        },
      });
      expect(tickets.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive ticket type', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: false });

      await expect(service.create(dto, buildActor(), 'key-1')).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'typeId', code: 'inactive' }] },
        },
      });
    });

    it('rejects a storage unit that does not belong to the selected facility', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      storageUnits.findOne.mockResolvedValue({ id: 'unit-1', facilityId: 'facility-2' });

      await expect(
        service.create({ ...dto, storageUnitId: 'unit-1' }, buildActor(), 'key-1'),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'storageUnitId', code: 'notBelongsToFacility' }] },
        },
      });
    });

    it('regenerates the ticket number on a unique-violation collision', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      em.findOneOrFail.mockResolvedValue(buildTicket({ customerId: 'customer-1' }));

      const collision = Object.assign(
        new QueryFailedError('INSERT', [], new Error('duplicate key')),
        { driverError: { code: '23505' } },
      );
      dataSource.transaction.mockRejectedValueOnce(collision);

      const result = await service.create(dto, buildActor({ id: 'customer-1' }), 'key-1');

      expect(dataSource.transaction).toHaveBeenCalledTimes(2);
      expect(result.data.ticket.ticket_no).toMatch(/^ST-\d{8}-[0-9A-F]{8}$/);
    });

    it('rejects a customer without an active contract on the unit', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      storageUnits.findOne.mockResolvedValue({ id: 'unit-1', facilityId: 'facility-1' });
      const builder = buildRentCheckBuilder(false);
      contracts.createQueryBuilder.mockReturnValue(builder);

      await expect(
        service.create({ ...dto, storageUnitId: 'unit-1' }, buildActor(), 'key-1'),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });

      expect(builder.andWhere).toHaveBeenCalledWith('bi.storageUnitId = :unitId', {
        unitId: 'unit-1',
      });
      expect(tickets.create).not.toHaveBeenCalled();
    });

    it('rejects a customer without an active contract in the facility', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      const builder = buildRentCheckBuilder(false);
      contracts.createQueryBuilder.mockReturnValue(builder);

      await expect(service.create(dto, buildActor(), 'key-1')).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });

      expect(builder.innerJoin).toHaveBeenCalledWith('bi.storageUnit', 'su');
      expect(tickets.create).not.toHaveBeenCalled();
    });

    it('accepts an ended contract for a facility-level ticket', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      const builder = buildRentCheckBuilder(true);
      contracts.createQueryBuilder.mockReturnValue(builder);
      em.findOneOrFail.mockResolvedValue(buildTicket({ customerId: 'customer-1' }));

      await service.create(dto, buildActor({ id: 'customer-1' }), 'key-1');

      expect(builder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('endedStatus'),
        expect.objectContaining({ endedStatus: ContractStatus.ENDED }),
      );
      expect(tickets.create).toHaveBeenCalled();
    });

    it('lets a customer with an active contract on the unit create a ticket', async () => {
      facilities.findOne.mockResolvedValue({ id: 'facility-1' });
      ticketTypes.findOne.mockResolvedValue({ id: 'type-1', isActive: true });
      storageUnits.findOne.mockResolvedValue({ id: 'unit-1', facilityId: 'facility-1' });
      em.findOneOrFail.mockResolvedValue(
        buildTicket({ customerId: 'customer-1', storageUnitId: 'unit-1' }),
      );

      const result = await service.create(
        { ...dto, storageUnitId: 'unit-1' },
        buildActor({ id: 'customer-1' }),
        'key-1',
      );

      expect(tickets.create).toHaveBeenCalled();
      expect(result.data.ticket.storage_unit_id).toBe('unit-1');
    });
  });

  describe('list', () => {
    it('scopes a customer to their own tickets only', async () => {
      const builder = buildQueryBuilder([buildTicket()], 1);
      tickets.createQueryBuilder.mockReturnValue(builder);

      const result = await service.list(
        {},
        buildActor({ id: 'customer-1', roles: [UserRole.CUSTOMER] }),
      );

      expect(builder.where).toHaveBeenCalledWith(
        expect.stringContaining('"ticket"."customer_id" = :customerId'),
        { customerId: 'customer-1' },
      );
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('scopes a facility staff member to tickets assigned to them', async () => {
      const builder = buildQueryBuilder([], 0);
      tickets.createQueryBuilder.mockReturnValue(builder);

      await service.list({}, buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] }));

      expect(builder.where).toHaveBeenCalledWith(
        expect.stringContaining('"ticket"."assigned_to" = :staffId'),
        { staffId: 'staff-1' },
      );
    });

    it('scopes a facility manager to their managed facilities', async () => {
      const builder = buildQueryBuilder([], 0);
      tickets.createQueryBuilder.mockReturnValue(builder);
      roleAssignments.find.mockResolvedValue([
        buildManagerAssignment('facility-1'),
        buildManagerAssignment('facility-2'),
      ]);

      await service.list({}, buildActor({ roles: [UserRole.FACILITY_MANAGER] }));

      expect(builder.where).toHaveBeenCalledWith(
        expect.stringContaining('"ticket"."facility_id" IN (:...managedFacilityIds)'),
        { managedFacilityIds: ['facility-1', 'facility-2'] },
      );
    });

    it('returns an empty page for a manager without active facility assignments', async () => {
      roleAssignments.find.mockResolvedValue([]);

      const result = await service.list({}, buildActor({ roles: [UserRole.FACILITY_MANAGER] }));

      expect(tickets.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.tickets).toEqual([]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    });

    it('lets an admin list every ticket without scope filtering', async () => {
      const builder = buildQueryBuilder([buildTicket()], 1);
      tickets.createQueryBuilder.mockReturnValue(builder);

      const result = await service.list({}, buildActor({ roles: [UserRole.ADMIN] }));

      expect(builder.where).not.toHaveBeenCalled();
      expect(roleAssignments.find).not.toHaveBeenCalled();
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('applies status, priority and type filters on top of the visibility scope', async () => {
      const builder = buildQueryBuilder([], 0);
      tickets.createQueryBuilder.mockReturnValue(builder);

      await service.list(
        { status: TicketStatus.OPEN, priority: TicketPriority.URGENT, typeId: 'type-1' },
        buildActor({ id: 'customer-1', roles: [UserRole.CUSTOMER] }),
      );

      expect(builder.andWhere).toHaveBeenCalledWith('ticket.status = :status', {
        status: TicketStatus.OPEN,
      });
      expect(builder.andWhere).toHaveBeenCalledWith('ticket.priority = :priority', {
        priority: TicketPriority.URGENT,
      });
      expect(builder.andWhere).toHaveBeenCalledWith('ticket.type_id = :typeId', {
        typeId: 'type-1',
      });
    });
  });

  describe('getOne', () => {
    it('rejects an unknown ticket', async () => {
      tickets.findOne.mockResolvedValue(null);

      await expect(service.getOne('ticket-1', buildActor())).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('lets a customer view their own ticket', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ customerId: 'customer-1' }));

      const result = await service.getOne('ticket-1', buildActor({ id: 'customer-1' }));

      expect(result.ticket.customer_id).toBe('customer-1');
    });

    it('forbids a customer from viewing another customer ticket', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ customerId: 'customer-2' }));

      await expect(
        service.getOne('ticket-1', buildActor({ id: 'customer-1' })),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });
    });

    it('forbids a staff member from viewing an unassigned ticket', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: undefined }));

      await expect(
        service.getOne('ticket-1', buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] })),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    });

    it('forbids a staff member from viewing a ticket assigned to another staff member', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: 'staff-2' }));

      await expect(
        service.getOne('ticket-1', buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] })),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    });

    it('lets a staff member view a ticket assigned to them', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: 'staff-1' }));

      const result = await service.getOne(
        'ticket-1',
        buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] }),
      );

      expect(result.ticket.assigned_to).toBe('staff-1');
    });

    it('forbids a manager from viewing a ticket of a facility they do not manage', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-2' }));
      roleAssignments.find.mockResolvedValue([buildManagerAssignment('facility-1')]);

      await expect(
        service.getOne('ticket-1', buildActor({ roles: [UserRole.FACILITY_MANAGER] })),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    });

    it('lets a manager view a ticket of a facility they manage', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-1' }));
      roleAssignments.find.mockResolvedValue([buildManagerAssignment('facility-1')]);

      const result = await service.getOne(
        'ticket-1',
        buildActor({ roles: [UserRole.FACILITY_MANAGER] }),
      );

      expect(result.ticket.facility_id).toBe('facility-1');
    });

    it('lets an admin view any ticket', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ customerId: 'customer-2', assignedTo: 'staff-2' }),
      );

      const result = await service.getOne('ticket-1', buildActor({ roles: [UserRole.ADMIN] }));

      expect(result.ticket.id).toBe('ticket-1');
      expect(roleAssignments.find).not.toHaveBeenCalled();
    });
  });

  describe('assign', () => {
    const dto = { assignedTo: 'staff-1' };
    const manager = buildActor({ id: 'manager-1', roles: [UserRole.FACILITY_MANAGER] });

    beforeEach(() => {
      roleAssignments.find.mockResolvedValue([buildManagerAssignment('facility-1')]);
      users.findOne.mockResolvedValue({ id: 'staff-1', status: UserStatus.ACTIVE });
      roleAssignments.findOne.mockResolvedValue(buildStaffAssignment('facility-1'));
    });

    it('assigns the staff member and moves OPEN tickets to ASSIGNED with history entries', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ facilityId: 'facility-1', assignedTo: undefined, status: TicketStatus.OPEN }),
      );

      const result = await service.assign('ticket-1', dto, manager);

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: 'staff-1',
          status: TicketStatus.ASSIGNED,
        }),
      );
      expect(result.ticket.assigned_to).toBe('staff-1');
      expect(result.ticket.status).toBe(TicketStatus.ASSIGNED);
      expect(result.ticket.history.map((entry) => entry.action)).toEqual([
        'ASSIGNED',
        'STATUS_CHANGED',
      ]);
    });

    it('forbids a manager from assigning a ticket of a facility they do not manage', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-2' }));

      await expect(service.assign('ticket-1', dto, manager)).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it.each([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED])(
      'forbids assigning a ticket whose status is %s',
      async (status) => {
        tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-1', status }));

        await expect(service.assign('ticket-1', dto, manager)).rejects.toMatchObject({
          status: 409,
          response: { code: 'CONFLICT' },
        });
        expect(tickets.save).not.toHaveBeenCalled();
      },
    );

    it('reassigns an ASSIGNED ticket to another staff member keeping its status', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({
          facilityId: 'facility-1',
          assignedTo: 'staff-2',
          status: TicketStatus.ASSIGNED,
        }),
      );

      const result = await service.assign('ticket-1', dto, manager);

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: 'staff-1', status: TicketStatus.ASSIGNED }),
      );
      expect(result.ticket.history.map((entry) => entry.action)).toEqual(['ASSIGNED']);
    });

    it('rejects an unknown assignee', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-1' }));
      users.findOne.mockResolvedValue(null);

      await expect(service.assign('ticket-1', dto, manager)).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'assignedTo', code: 'notFound' }] },
        },
      });
    });

    it('rejects an assignee who is not an active facility staff member of the facility', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-1' }));
      roleAssignments.findOne.mockResolvedValue(null);

      await expect(service.assign('ticket-1', dto, manager)).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'assignedTo', code: 'notFacilityStaff' }] },
        },
      });
      expect(tickets.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const staff = buildActor({ id: 'staff-1', roles: [UserRole.FACILITY_STAFF] });

    it('lets a staff member update processing fields of an assigned ticket', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ assignedTo: 'staff-1', status: TicketStatus.ASSIGNED }),
      );

      const result = await service.update(
        'ticket-1',
        { status: TicketStatus.RESOLVED, resolution: 'Fixed' },
        staff,
      );

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TicketStatus.RESOLVED,
          resolution: 'Fixed',
          resolvedAt: expect.any(Date),
        }),
      );
      expect(result.ticket.history.map((entry) => entry.action)).toEqual(['STATUS_CHANGED']);
      expect(result.ticket.history[0].from).toBe(TicketStatus.ASSIGNED);
      expect(result.ticket.history[0].to).toBe(TicketStatus.RESOLVED);
    });

    it('clears the resolution when null is sent', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ assignedTo: 'staff-1', resolution: 'Old fix' }),
      );

      const result = await service.update('ticket-1', { resolution: null }, staff);

      expect(tickets.save).toHaveBeenCalledWith(expect.objectContaining({ resolution: null }));
      expect(result.ticket.resolution).toBeNull();
    });

    it('forbids a staff member from updating an unassigned ticket', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: undefined }));

      await expect(
        service.update('ticket-1', { status: TicketStatus.IN_PROGRESS }, staff),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it('forbids a staff member from updating a ticket assigned to another staff member', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: 'staff-2' }));

      await expect(
        service.update('ticket-1', { status: TicketStatus.IN_PROGRESS }, staff),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it('forbids staff from setting CANCELLED — that belongs to the cancel endpoint', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ assignedTo: 'staff-1', status: TicketStatus.IN_PROGRESS }),
      );

      await expect(
        service.update('ticket-1', { status: TicketStatus.CANCELLED }, staff),
      ).rejects.toMatchObject({
        status: 400,
        response: {
          code: 'VALIDATION_FAILED',
          details: { fields: [{ field: 'status', code: 'notAllowed' }] },
        },
      });
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it('lets staff close a ticket after the customer confirmed in person', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ assignedTo: 'staff-1', status: TicketStatus.RESOLVED }),
      );

      const result = await service.update('ticket-1', { status: TicketStatus.CLOSED }, staff);

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TicketStatus.CLOSED }),
      );
      expect(result.ticket.history.map((entry) => entry.action)).toEqual(['STATUS_CHANGED']);
      expect(result.ticket.history[0].to).toBe(TicketStatus.CLOSED);
    });

    it.each([TicketStatus.CLOSED, TicketStatus.CANCELLED])(
      'forbids updating a ticket whose status is %s',
      async (status) => {
        tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: 'staff-1', status }));

        await expect(
          service.update('ticket-1', { resolution: 'Edit after close' }, staff),
        ).rejects.toMatchObject({ status: 409, response: { code: 'CONFLICT' } });
        expect(tickets.save).not.toHaveBeenCalled();
      },
    );

    it('lets staff change the priority with a history entry', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ assignedTo: 'staff-1', status: TicketStatus.IN_PROGRESS }),
      );

      const result = await service.update('ticket-1', { priority: TicketPriority.URGENT }, staff);

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({ priority: TicketPriority.URGENT }),
      );
      expect(result.ticket.priority).toBe(TicketPriority.URGENT);
      expect(result.ticket.history.map((entry) => entry.action)).toEqual(['PRIORITY_CHANGED']);
      expect(result.ticket.history[0].from).toBe(TicketPriority.NORMAL);
    });
  });

  describe('cancel', () => {
    const owner = buildActor({ id: 'customer-1', roles: [UserRole.CUSTOMER] });
    const manager = buildActor({ id: 'manager-1', roles: [UserRole.FACILITY_MANAGER] });

    it('lets the owning customer cancel an open ticket with a history entry', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ customerId: 'customer-1', status: TicketStatus.ASSIGNED }),
      );

      const result = await service.cancel('ticket-1', owner);

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TicketStatus.CANCELLED }),
      );
      expect(result.ticket.history.map((entry) => entry.action)).toEqual(['STATUS_CHANGED']);
      expect(result.ticket.history[0].from).toBe(TicketStatus.ASSIGNED);
      expect(result.ticket.history[0].to).toBe(TicketStatus.CANCELLED);
    });

    it('forbids a customer from cancelling another customer ticket', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ customerId: 'customer-2' }));

      await expect(service.cancel('ticket-1', owner)).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it('lets a facility manager cancel a ticket of a facility they manage', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({
          facilityId: 'facility-1',
          customerId: 'customer-1',
          status: TicketStatus.IN_PROGRESS,
        }),
      );
      roleAssignments.find.mockResolvedValue([buildManagerAssignment('facility-1')]);

      await service.cancel('ticket-1', manager);

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TicketStatus.CANCELLED }),
      );
    });

    it('forbids a manager from cancelling a ticket of a facility they do not manage', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ facilityId: 'facility-2', customerId: 'customer-1' }),
      );
      roleAssignments.find.mockResolvedValue([buildManagerAssignment('facility-1')]);

      await expect(service.cancel('ticket-1', manager)).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it.each([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED])(
      'rejects cancelling a ticket whose status is %s',
      async (status) => {
        tickets.findOne.mockResolvedValue(buildTicket({ customerId: 'customer-1', status }));

        await expect(service.cancel('ticket-1', owner)).rejects.toMatchObject({
          status: 409,
          response: { code: 'CONFLICT' },
        });
        expect(tickets.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('close', () => {
    const owner = buildActor({ id: 'customer-1', roles: [UserRole.CUSTOMER] });

    it('lets the owning customer close a resolved ticket with a history entry', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ customerId: 'customer-1', status: TicketStatus.RESOLVED }),
      );

      const result = await service.close('ticket-1', owner);

      expect(tickets.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TicketStatus.CLOSED }),
      );
      expect(result.ticket.status).toBe(TicketStatus.CLOSED);
      expect(result.ticket.history.map((entry) => entry.action)).toEqual(['STATUS_CHANGED']);
      expect(result.ticket.history[0].from).toBe(TicketStatus.RESOLVED);
      expect(result.ticket.history[0].to).toBe(TicketStatus.CLOSED);
    });

    it('forbids a non-owner from closing the ticket', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ customerId: 'customer-2', status: TicketStatus.RESOLVED }),
      );

      await expect(service.close('ticket-1', owner)).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });
      expect(tickets.save).not.toHaveBeenCalled();
    });

    it.each([
      TicketStatus.OPEN,
      TicketStatus.ASSIGNED,
      TicketStatus.IN_PROGRESS,
      TicketStatus.CLOSED,
      TicketStatus.CANCELLED,
    ])('rejects closing a ticket whose status is %s', async (status) => {
      tickets.findOne.mockResolvedValue(buildTicket({ customerId: 'customer-1', status }));

      await expect(service.close('ticket-1', owner)).rejects.toMatchObject({
        status: 409,
        response: { code: 'CONFLICT' },
      });
      expect(tickets.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const admin = buildActor({ id: 'admin-1', roles: [UserRole.ADMIN] });
    const manager = buildActor({ id: 'manager-1', roles: [UserRole.FACILITY_MANAGER] });

    it('rejects an unknown ticket', async () => {
      tickets.findOne.mockResolvedValue(null);

      await expect(service.remove('ticket-1', admin)).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(tickets.delete).not.toHaveBeenCalled();
    });

    it('lets an admin delete a ticket assigned to a staff member', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: 'staff-1' }));

      await expect(service.remove('ticket-1', admin)).resolves.toEqual({
        deleted: true,
        id: 'ticket-1',
      });

      expect(tickets.save).not.toHaveBeenCalled();
      expect(tickets.delete).toHaveBeenCalledWith({ id: 'ticket-1' });
    });

    it('lets an admin delete an unassigned ticket', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: undefined }));

      await expect(service.remove('ticket-1', admin)).resolves.toEqual({
        deleted: true,
        id: 'ticket-1',
      });

      expect(tickets.delete).toHaveBeenCalledWith({ id: 'ticket-1' });
    });

    it('forbids a facility manager from deleting a ticket', async () => {
      tickets.findOne.mockResolvedValue(
        buildTicket({ facilityId: 'facility-1', assignedTo: 'staff-1' }),
      );

      await expect(service.remove('ticket-1', manager)).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });
      expect(tickets.delete).not.toHaveBeenCalled();
    });

    it('reports deleted: false when the row is already gone', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ assignedTo: undefined }));
      tickets.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove('ticket-1', admin)).resolves.toEqual({
        deleted: false,
        id: 'ticket-1',
      });
    });

    it('forbids a manager from deleting a ticket of a facility they do not manage', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-2' }));
      roleAssignments.find.mockResolvedValue([buildManagerAssignment('facility-1')]);

      await expect(service.remove('ticket-1', manager)).rejects.toMatchObject({
        status: 403,
        response: { code: 'FORBIDDEN' },
      });
      expect(tickets.delete).not.toHaveBeenCalled();
    });

    it('forbids a customer from deleting a ticket', async () => {
      tickets.findOne.mockResolvedValue(buildTicket({ facilityId: 'facility-1' }));
      roleAssignments.find.mockResolvedValue([]);

      await expect(
        service.remove('ticket-1', buildActor({ roles: [UserRole.CUSTOMER] })),
      ).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
      expect(tickets.delete).not.toHaveBeenCalled();
    });
  });
});
