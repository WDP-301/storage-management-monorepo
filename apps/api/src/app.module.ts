import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CustomerModule } from './modules/customer/customer.module';
import { FacilitiesModule } from './modules/facilities/facilities.module';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { UploadModule } from './modules/upload/upload.module';
import { ENV_KEY } from './shared/constants';
import { RequestIdMiddleware } from './shared/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>(ENV_KEY.DB_HOST),
        port: +configService.getOrThrow<number>(ENV_KEY.DB_PORT),
        username: configService.getOrThrow<string>(ENV_KEY.DB_USERNAME),
        password: configService.getOrThrow<string>(ENV_KEY.DB_PASSWORD),
        database: configService.getOrThrow<string>(ENV_KEY.DB_DATABASE),
        ssl:
          configService.get<string>(ENV_KEY.DB_SSL, 'false').toLowerCase() === 'true'
            ? { rejectUnauthorized: false }
            : false,
        autoLoadEntities: true,
        synchronize:
          configService.get<string>(ENV_KEY.DB_SYNCHRONIZE, 'false').toLowerCase() === 'true',
        logging: configService.get<string>(ENV_KEY.DB_LOGGING, 'false').toLowerCase() === 'true',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AdminModule,
    FacilitiesModule,
    BookingsModule,
    HealthModule,
    LocationsModule,
    UploadModule,
    CustomerModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
