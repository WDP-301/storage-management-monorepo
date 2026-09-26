import { AuthModule } from '@modules/auth/auth.module';
import { Contract } from '@modules/contracts/entities/contract.entity';
import { Document } from '@modules/misc/entities/document.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { AppUser } from './entities/app-user.entity';
import { CustomerProfile } from './entities/customer-profile.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppUser, CustomerProfile, Document, Contract]),
    AuthModule, // provides SessionGuard for the controller
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
