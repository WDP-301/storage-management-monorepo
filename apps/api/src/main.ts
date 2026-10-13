import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from '@shared/filters/http-exception.filter';
import { HttpLoggingInterceptor } from '@shared/interceptors/http-logging.interceptor';
import { HttpResponseInterceptor } from '@shared/interceptors/http-response.interceptor';
import { ApiSuccessResponseDto } from '@shared/models/api-response';
import { createApiValidationPipe } from '@shared/pipes/api-validation.pipe';
import { applySuccessEnvelope } from '@shared/utils/swagger-envelope.util';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Above Express's 100kb default: a full shelf floor plan (up to 1000 placements + 500 elements)
  // is sent as one JSON document.
  app.useBodyParser('json', { limit: '256kb' });

  // Trust the first proxy hop (Render/Cloudflare) so req.ip is the real client IP —
  // ThrottlerGuard and session context depend on it.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  app.enableShutdownHooks();

  // ponytail: CSP off — Swagger UI needs inline assets; re-enable when docs are dropped in prod
  app.use(helmet({ contentSecurityPolicy: false }));

  const enableCors = configService.get<string>('ENABLE_CORS', 'true') === 'true';
  if (enableCors) {
    const origins = configService
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim());
    app.enableCors({
      origin: origins,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
    });
  }

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(createApiValidationPipe());

  app.useGlobalInterceptors(
    new HttpLoggingInterceptor(),
    new HttpResponseInterceptor(app.get(Reflector)),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const enableSwagger = configService.get<string>('ENABLE_SWAGGER', 'true') === 'true';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Storage Management API')
      .setDescription('REST API for Storage & Warehouse Inventory Management')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = applySuccessEnvelope(
      SwaggerModule.createDocument(app, config, { extraModels: [ApiSuccessResponseDto] }),
    );
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = +configService.get<number>('PORT', 3001);
  await app.listen(port);

  logger.log(`Storage Management API running on: http://localhost:${port}/api/v1`);
  if (enableSwagger) {
    logger.log(`Swagger API Docs available at: http://localhost:${port}/docs`);
  }
}

bootstrap();
