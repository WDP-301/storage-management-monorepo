import type { AuthUser } from '@modules/auth/types/auth-user';
import { Booking } from '@modules/bookings/entities/booking.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBookingDto } from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  /**
   * Create a new booking and hold selected storage units for 15 minutes.
   * TODO: implement full transaction logic when StorageUnitsService + UnitHoldsService are ready.
   */
  async create(_dto: CreateBookingDto, _user: AuthUser): Promise<{ message: string }> {
    // TODO: validate units availability, create booking_items, create unit_holds, update unit status
    return { message: 'Booking creation — not yet implemented' };
  }

  /**
   * Return all bookings belonging to the authenticated customer.
   */
  async findByCustomer(userId: string): Promise<Booking[]> {
    return this.bookingRepo.find({
      where: { customerId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Confirm a booking (customer has paid the deposit).
   * TODO: implement status transition and hold conversion.
   */
  async confirm(_id: string, _user: AuthUser): Promise<{ message: string }> {
    // TODO: validate ownership, check status = HOLDING | PENDING_DEPOSIT, transition to CONFIRMED
    return { message: 'Booking confirm — not yet implemented' };
  }

  /**
   * Cancel a booking and release held storage units.
   * TODO: implement status transition and unit release.
   */
  async cancel(_id: string, _user: AuthUser): Promise<{ message: string }> {
    // TODO: validate ownership, transition to CANCELLED, release unit_holds, restore unit status
    return { message: 'Booking cancel — not yet implemented' };
  }
}
