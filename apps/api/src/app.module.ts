import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { ENV_KEY } from './shared/constants';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>(ENV_KEY.DB_HOST, 'localhost'),
        port: +configService.get<number>(ENV_KEY.DB_PORT, 5432),
        username: configService.get<string>(ENV_KEY.DB_USERNAME, 'postgres'),
        password: configService.get<string>(ENV_KEY.DB_PASSWORD, 'postgrespassword'),
        database: configService.get<string>(ENV_KEY.DB_DATABASE, 'storage_management_db'),
        autoLoadEntities: true,
        synchronize:
          configService.get<string>(ENV_KEY.DB_SYNCHRONIZE, 'true').toLowerCase() === 'true',
        logging: configService.get<string>(ENV_KEY.DB_LOGGING, 'false').toLowerCase() === 'true',
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    StorageModule,
  ],
})
export class AppModule {}
