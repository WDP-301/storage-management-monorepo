import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const RAW_RESPONSE_KEY = 'rawResponse';
/** Marks the operation in the OpenAPI document so the envelope transform leaves it unwrapped. */
export const RAW_RESPONSE_EXTENSION = 'x-raw-response';

export const RawResponse = () =>
  applyDecorators(SetMetadata(RAW_RESPONSE_KEY, true), ApiExtension(RAW_RESPONSE_EXTENSION, true));
