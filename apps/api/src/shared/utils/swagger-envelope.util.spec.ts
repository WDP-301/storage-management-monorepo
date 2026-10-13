import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  INestApplication,
  Post,
} from '@nestjs/common';
import {
  ApiProperty,
  ApiResponse,
  getSchemaPath,
  OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { RawResponse } from '../decorators/raw-response.decorator';
import { ApiErrorResponseDto, ApiSuccessResponseDto } from '../models/api-response';
import { applySuccessEnvelope } from './swagger-envelope.util';

class ItemDto {
  @ApiProperty()
  id: string;
}

@Controller('items')
class ItemsController {
  @Get()
  @ApiResponse({ status: 200, type: [ItemDto] })
  list() {}

  @Post()
  @ApiResponse({ status: 201, type: ItemDto })
  @ApiResponse({ status: 404, type: ApiErrorResponseDto })
  create() {}

  @Get('untyped')
  untyped() {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove() {}

  @Get('file')
  @ApiResponse({
    status: 200,
    content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
  })
  file() {}

  @Post('webhook')
  @RawResponse()
  @ApiResponse({ status: 200, type: ItemDto })
  webhook() {}
}

const envelope = (data: unknown) => ({
  allOf: [
    { $ref: getSchemaPath(ApiSuccessResponseDto) },
    { type: 'object', required: ['data'], properties: { data } },
  ],
});

describe('applySuccessEnvelope', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  const schemaOf = (path: string, method: 'get' | 'post' | 'delete', status: string) =>
    document.paths[path][method]?.responses[status];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ItemsController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    document = applySuccessEnvelope(
      SwaggerModule.createDocument(
        app,
        { openapi: '3.0.0', info: { title: 't', version: '1' } },
        {
          extraModels: [ApiSuccessResponseDto],
        },
      ),
    );
  });

  afterAll(() => app.close());

  it('wraps declared success schemas under data, including arrays', () => {
    expect(schemaOf('/items', 'get', '200')).toMatchObject({
      content: {
        'application/json': {
          schema: envelope({ type: 'array', items: { $ref: getSchemaPath(ItemDto) } }),
        },
      },
    });
    expect(schemaOf('/items', 'post', '201')).toMatchObject({
      content: { 'application/json': { schema: envelope({ $ref: getSchemaPath(ItemDto) }) } },
    });
    expect(document.components?.schemas).toHaveProperty('ApiSuccessResponseDto');
  });

  it('gives undocumented success responses the envelope with untyped data', () => {
    expect(schemaOf('/items/untyped', 'get', '200')).toMatchObject({
      content: { 'application/json': { schema: envelope({}) } },
    });
  });

  it('leaves errors, 204, non-JSON bodies, and raw routes unwrapped', () => {
    expect(schemaOf('/items', 'post', '404')).toMatchObject({
      content: { 'application/json': { schema: { $ref: getSchemaPath(ApiErrorResponseDto) } } },
    });
    expect(schemaOf('/items/{id}', 'delete', '204')).not.toHaveProperty('content');
    expect(schemaOf('/items/file', 'get', '200')).toEqual(
      expect.objectContaining({ content: { 'application/octet-stream': expect.anything() } }),
    );
    expect(schemaOf('/items/webhook', 'post', '200')).toMatchObject({
      content: { 'application/json': { schema: { $ref: getSchemaPath(ItemDto) } } },
    });
  });
});
