import { ShiftTemplate } from '@entities/shift-template.entity';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DomainException,
  fieldValidationError,
  notFound,
} from '@shared/exceptions/domain.exception';
import { ErrorCode } from '@shared/models/api-response';
import { isUniqueViolation } from '@shared/utils/pg-error.util';
import { Not, type Repository } from 'typeorm';
import type { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import type { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';
import { isEmptyShift, shiftsOverlap } from './shift-time';
import {
  type ShiftTemplateListResponse,
  type ShiftTemplateResponse,
  toShiftTemplateRecord,
} from './types/shift-template';

/** Serializes writes, so two admins cannot each add a shift that overlaps the other's. */
const WRITE_LOCK_KEY = 'shift_templates';

@Injectable()
export class ShiftTemplatesService {
  constructor(
    @InjectRepository(ShiftTemplate)
    private readonly templates: Repository<ShiftTemplate>,
  ) {}

  /** All templates, active or not, in the order of the day. */
  async list(): Promise<ShiftTemplateListResponse> {
    const rows = await this.templates.find({ order: { startTime: 'ASC', code: 'ASC' } });
    return { shift_templates: rows.map(toShiftTemplateRecord) };
  }

  /** The shifts staff can be scheduled on, in the order of the day. */
  async listActive(): Promise<ShiftTemplateListResponse> {
    const rows = await this.templates.find({
      where: { isActive: true },
      order: { startTime: 'ASC', code: 'ASC' },
    });
    return { shift_templates: rows.map(toShiftTemplateRecord) };
  }

  create(dto: CreateShiftTemplateDto): Promise<ShiftTemplateResponse> {
    return this.withWriteLock(async (repo) => {
      const template = repo.create({ ...dto, isActive: dto.isActive ?? true });
      return { shift_template: toShiftTemplateRecord(await this.validateAndSave(repo, template)) };
    });
  }

  update(id: string, dto: UpdateShiftTemplateDto): Promise<ShiftTemplateResponse> {
    return this.withWriteLock(async (repo) => {
      const template = (await repo.findOne({ where: { id } })) ?? notFound('Shift template', id);
      if (dto.name !== undefined) template.name = dto.name;
      if (dto.startTime !== undefined) template.startTime = dto.startTime;
      if (dto.endTime !== undefined) template.endTime = dto.endTime;
      if (dto.isActive !== undefined) template.isActive = dto.isActive;
      return { shift_template: toShiftTemplateRecord(await this.validateAndSave(repo, template)) };
    });
  }

  /** Soft delete, so the code becomes free again while the row stays for history. */
  async remove(id: string): Promise<ShiftTemplateResponse> {
    const template =
      (await this.templates.findOne({ where: { id } })) ?? notFound('Shift template', id);
    await this.templates.softDelete(template.id);
    return { shift_template: toShiftTemplateRecord(template) };
  }

  private withWriteLock<T>(work: (repo: Repository<ShiftTemplate>) => Promise<T>): Promise<T> {
    return this.templates.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [WRITE_LOCK_KEY]);
      return work(manager.getRepository(ShiftTemplate));
    });
  }

  private async validateAndSave(
    repo: Repository<ShiftTemplate>,
    template: ShiftTemplate,
  ): Promise<ShiftTemplate> {
    if (isEmptyShift(template)) {
      throw fieldValidationError('endTime', 'SHIFT_EMPTY', 'endTime must differ from startTime');
    }
    if (template.isActive) await this.assertNoOverlap(repo, template);

    try {
      return await repo.save(template);
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new DomainException(
          ErrorCode.SHIFT_TEMPLATE_CODE_TAKEN,
          `Shift template code ${template.code} is already in use`,
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /** Active shifts must not share any minute of the day. */
  private async assertNoOverlap(
    repo: Repository<ShiftTemplate>,
    template: ShiftTemplate,
  ): Promise<void> {
    const others = await repo.find({
      where: { isActive: true, ...(template.id ? { id: Not(template.id) } : {}) },
    });
    const clash = others.find((other) => shiftsOverlap(template, other));
    if (clash) {
      throw new DomainException(
        ErrorCode.SHIFT_TEMPLATE_OVERLAP,
        `Shift overlaps active shift ${clash.code}`,
        HttpStatus.CONFLICT,
        { conflict_with: toShiftTemplateRecord(clash) },
      );
    }
  }
}
