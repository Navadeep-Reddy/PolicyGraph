import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { CreateItemDto, UpdateItemDto } from './dto.js';
import type { ItemDto } from './dto.js';
import { ItemsService } from './items.service.js';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  listItems(): Promise<ItemDto[]> { return this.itemsService.listItems(); }

  @Post()
  createItem(@Body() body: CreateItemDto): Promise<ItemDto> { return this.itemsService.createItem(body); }

  @Patch(':id')
  updateItem(@Param('id') id: string, @Body() body: UpdateItemDto): Promise<ItemDto> {
    return this.itemsService.updateItem(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(@Param('id') id: string): Promise<void> { return this.itemsService.deleteItem(id); }
}
