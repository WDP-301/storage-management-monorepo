import { getSchemaPath, type OpenAPIObject } from '@nestjs/swagger';
import type {
  OperationObject,
  PathItemObject,
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { RAW_RESPONSE_EXTENSION } from '../decorators/raw-response.decorator';
import { ApiSuccessResponseDto } from '../models/api-response';

const JSON_MEDIA_TYPE = 'application/json';
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

const envelopeSchema = (data: SchemaObject | ReferenceObject): SchemaObject => ({
  allOf: [
    { $ref: getSchemaPath(ApiSuccessResponseDto) },
    { type: 'object', required: ['data'], properties: { data } },
  ],
});

function wrapOperation(operation: OperationObject): void {
  for (const [status, response] of Object.entries(operation.responses)) {
    if (!status.startsWith('2') || status === '204' || '$ref' in response) continue;

    const content = response.content ?? {};
    const json = content[JSON_MEDIA_TYPE];
    // A body declared only under other media types (a file download) is not enveloped.
    if (!json && Object.keys(content).length > 0) continue;

    response.content = {
      ...content,
      [JSON_MEDIA_TYPE]: { ...json, schema: envelopeSchema(json?.schema ?? {}) },
    };
  }
}

/**
 * Documents what HttpResponseInterceptor does at runtime: every 2xx JSON response, except 204 and
 * routes marked @RawResponse(), is the success envelope with the route's declared schema under
 * `data`. The document must be created with ApiSuccessResponseDto in `extraModels`.
 */
export function applySuccessEnvelope(document: OpenAPIObject): OpenAPIObject {
  for (const pathItem of Object.values<PathItemObject>(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation && !(RAW_RESPONSE_EXTENSION in operation)) {
        wrapOperation(operation);
      }
    }
  }
  return document;
}
