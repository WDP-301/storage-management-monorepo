import { EvidenceFileDto } from '@modules/inspection/dto/inspection-evidence.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, ValidateNested } from 'class-validator';

export const MAX_CONTRACT_DOCUMENTS = 10;

export const CONTRACT_DOCUMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

/**
 * Same shape as an inspection evidence file, but only images and PDFs. The extra rule is
 * attached to the inherited property: redeclaring the field would reset it under
 * `useDefineForClassFields`.
 */
export class ContractDocumentDto extends EvidenceFileDto {}
IsIn(CONTRACT_DOCUMENT_MIME_TYPES)(ContractDocumentDto.prototype, 'mimeType');
ApiProperty({ enum: CONTRACT_DOCUMENT_MIME_TYPES })(ContractDocumentDto.prototype, 'mimeType');

export class ReplaceContractDocumentsDto {
  @ApiProperty({
    type: [ContractDocumentDto],
    maxItems: MAX_CONTRACT_DOCUMENTS,
    description: 'The full list: replaces whatever the contract held before',
  })
  @IsArray()
  @ArrayMaxSize(MAX_CONTRACT_DOCUMENTS)
  @ArrayUnique((file: ContractDocumentDto) => file.fileKey)
  @ValidateNested({ each: true })
  @Type(() => ContractDocumentDto)
  documents: ContractDocumentDto[];
}
