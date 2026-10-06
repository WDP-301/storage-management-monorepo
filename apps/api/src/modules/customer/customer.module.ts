import { AppUser } from '@entities/app-user.entity';
import { Contract } from '@entities/contract.entity';
import { CustomerProfile } from '@entities/customer-profile.entity';
import { Document } from '@entities/document.entity';
import { Session } from '@entities/session.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppUser, CustomerProfile, Session, Document, Contract]),
    AuthModule, // provides SessionGuard for the controller
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
