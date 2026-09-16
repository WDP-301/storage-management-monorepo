import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateStorageItemDto, UpdateStorageItemDto } from './dto/create-storage-item.dto';
import { CreateStorageLocationDto } from './dto/create-storage-location.dto';
import { QueryStorageItemDto } from './dto/query-storage-item.dto';
import { StorageService } from './storage.service';

@ApiTags('Storage Management')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get summary metrics for storage dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard metrics summary' })
  async getDashboardSummary() {
    return this.storageService.getDashboardSummary();
  }

  // --- Locations ---
  @Post('locations')
  @ApiOperation({ summary: 'Create a new warehouse or storage location' })
  async createLocation(@Body() dto: CreateStorageLocationDto) {
    return this.storageService.createLocation(dto);
  }

  @Get('locations')
  @ApiOperation({ summary: 'List all storage locations' })
  async findAllLocations() {
    return this.storageService.findAllLocations();
  }

  @Get('locations/:id')
  @ApiOperation({ summary: 'Get location detail by ID' })
  async findLocationById(@Param('id') id: string) {
    return this.storageService.findLocationById(id);
  }

  // --- Items ---
  @Post('items')
  @ApiOperation({ summary: 'Create a new storage inventory item' })
  async createItem(@Body() dto: CreateStorageItemDto) {
    return this.storageService.createItem(dto);
  }

  @Get('items')
  @ApiOperation({ summary: 'List and filter storage items with pagination' })
  async findAllItems(@Query() query: QueryStorageItemDto) {
    return this.storageService.findAllItems(query);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get storage item by ID' })
  async findItemById(@Param('id') id: string) {
    return this.storageService.findItemById(id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update storage item attributes or stock' })
  async updateItem(@Param('id') id: string, @Body() dto: UpdateStorageItemDto) {
    return this.storageService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete (soft-delete) storage item' })
  async removeItem(@Param('id') id: string) {
    return this.storageService.removeItem(id);
  }
}
