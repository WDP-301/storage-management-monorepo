import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateShiftTemplateDto } from './create-shift-template.dto';

/** Every field but `code`, which stays fixed once created. */
export class UpdateShiftTemplateDto extends PartialType(
  OmitType(CreateShiftTemplateDto, ['code'] as const),
) {}
