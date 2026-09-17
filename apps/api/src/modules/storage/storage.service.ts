import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StorageDashboardSummary, StorageItemStatus } from '@storage/types';
import { Repository } from 'typeorm';
import { CreateStorageItemDto, UpdateStorageItemDto } from './dto/create-storage-item.dto';
import { CreateStorageLocationDto } from './dto/create-storage-location.dto';
import { QueryStorageItemDto } from './dto/query-storage-item.dto';
import { StorageItem } from './entities/storage-item.entity';
import { StorageLocation } from './entities/storage-location.entity';

@Injectable()
export class StorageService implements OnModuleInit {
  constructor(
    @InjectRepository(StorageItem)
    private readonly itemRepo: Repository<StorageItem>,
    @InjectRepository(StorageLocation)
    private readonly locationRepo: Repository<StorageLocation>,
  ) {}

  async onModuleInit() {
    // Auto-seed initial starter warehouse data if table is empty
    await this.seedInitialDataIfEmpty();
  }

  // --- Storage Locations ---
  async createLocation(dto: CreateStorageLocationDto): Promise<StorageLocation> {
    const existing = await this.locationRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Location with code '${dto.code}' already exists`);
    }
    const location = this.locationRepo.create(dto);
    return this.locationRepo.save(location);
  }

  async findAllLocations(): Promise<StorageLocation[]> {
    return this.locationRepo.find({
      order: { code: 'ASC' },
      relations: ['items'],
    });
  }

  async findLocationById(id: string): Promise<StorageLocation> {
    const location = await this.locationRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!location) {
      throw new NotFoundException(`Location #${id} not found`);
    }
    return location;
  }

  // --- Storage Items ---
  async createItem(dto: CreateStorageItemDto): Promise<StorageItem> {
    const existing = await this.itemRepo.findOne({ where: { sku: dto.sku } });
    if (existing) {
      throw new BadRequestException(`Storage item with SKU '${dto.sku}' already exists`);
    }

    if (dto.locationId) {
      const location = await this.locationRepo.findOne({ where: { id: dto.locationId } });
      if (!location) {
        throw new NotFoundException(`Location #${dto.locationId} not found`);
      }
    }

    // Determine status automatically if not explicitly given
    let status = dto.status || StorageItemStatus.IN_STOCK;
    if (dto.quantity === 0) {
      status = StorageItemStatus.OUT_OF_STOCK;
    } else if (dto.quantity <= (dto.minQuantity ?? 5)) {
      status = StorageItemStatus.LOW_STOCK;
    }

    const item = this.itemRepo.create({
      ...dto,
      status,
    });
    return this.itemRepo.save(item);
  }

  async findAllItems(query: QueryStorageItemDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.location', 'location');

    if (query.search) {
      qb.andWhere(
        '(item.sku ILIKE :search OR item.name ILIKE :search OR item.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.locationId) {
      qb.andWhere('item.locationId = :locationId', { locationId: query.locationId });
    }

    qb.orderBy('item.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findItemById(id: string): Promise<StorageItem> {
    const item = await this.itemRepo.findOne({
      where: { id },
      relations: ['location'],
    });
    if (!item) {
      throw new NotFoundException(`Storage item #${id} not found`);
    }
    return item;
  }

  async updateItem(id: string, dto: UpdateStorageItemDto): Promise<StorageItem> {
    const item = await this.findItemById(id);

    if (dto.locationId) {
      const location = await this.locationRepo.findOne({ where: { id: dto.locationId } });
      if (!location) {
        throw new NotFoundException(`Location #${dto.locationId} not found`);
      }
    }

    Object.assign(item, dto);

    // Auto-update status when quantity is modified and status wasn't explicitly forced
    if (dto.quantity !== undefined && !dto.status) {
      if (item.quantity === 0) {
        item.status = StorageItemStatus.OUT_OF_STOCK;
      } else if (item.quantity <= item.minQuantity) {
        item.status = StorageItemStatus.LOW_STOCK;
      } else {
        item.status = StorageItemStatus.IN_STOCK;
      }
    }

    return this.itemRepo.save(item);
  }

  async removeItem(id: string): Promise<{ id: string; deleted: boolean }> {
    const item = await this.findItemById(id);
    await this.itemRepo.softRemove(item);
    return { id, deleted: true };
  }

  // --- Dashboard Summary ---
  async getDashboardSummary(): Promise<StorageDashboardSummary> {
    const [totalLocations, totalItems, items] = await Promise.all([
      this.locationRepo.count(),
      this.itemRepo.count(),
      this.itemRepo.find({ select: ['quantity', 'status'] }),
    ]);

    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const lowStockCount = items.filter(
      (item) => item.status === StorageItemStatus.LOW_STOCK,
    ).length;
    const outOfStockCount = items.filter(
      (item) => item.status === StorageItemStatus.OUT_OF_STOCK,
    ).length;

    return {
      totalLocations,
      totalItems,
      totalQuantity,
      lowStockCount,
      outOfStockCount,
    };
  }

  private async seedInitialDataIfEmpty() {
    try {
      const count = await this.locationRepo.count();
      if (count > 0) return;

      const locA = await this.locationRepo.save(
        this.locationRepo.create({
          code: 'WH-ZONE-A',
          name: 'Main Logistics Zone A',
          description: 'High-turnover dry goods storage',
          address: 'Warehouse Block 1, Central Port',
          capacity: 2500,
        }),
      );

      const locB = await this.locationRepo.save(
        this.locationRepo.create({
          code: 'WH-ZONE-B',
          name: 'Cold & Secure Storage B',
          description: 'Temperature controlled section',
          address: 'Warehouse Block 2, East Gate',
          capacity: 1200,
        }),
      );

      await this.itemRepo.save([
        this.itemRepo.create({
          sku: 'STG-BOX-001',
          name: 'Heavy Duty Storage Tote 60L',
          description: 'Stackable industrial plastic storage container with locking lid',
          quantity: 180,
          minQuantity: 20,
          unit: 'units',
          price: 18.5,
          status: StorageItemStatus.IN_STOCK,
          locationId: locA.id,
        }),
        this.itemRepo.create({
          sku: 'STG-RACK-002',
          name: 'Adjustable Steel Shelving Unit',
          description: '4-Tier commercial grade shelving rack, 800kg load rating',
          quantity: 8,
          minQuantity: 10,
          unit: 'sets',
          price: 145.0,
          status: StorageItemStatus.LOW_STOCK,
          locationId: locA.id,
        }),
        this.itemRepo.create({
          sku: 'STG-PAL-003',
          name: 'Euro Timber Pallet 1200x800',
          description: 'Certified heat-treated wooden logistics pallet',
          quantity: 0,
          minQuantity: 30,
          unit: 'pallets',
          price: 24.0,
          status: StorageItemStatus.OUT_OF_STOCK,
          locationId: locB.id,
        }),
      ]);
    } catch {
      // Ignored if DB table not yet synchronized on first migration
    }
  }
}
