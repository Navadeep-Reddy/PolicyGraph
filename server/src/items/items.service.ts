import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateItemDto, ItemDto, UpdateItemDto } from './dto.js';

const itemSelect = { id: true, name: true, type: true, department: true, description: true, content: true } satisfies Prisma.ArtifactSelect;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async listItems(): Promise<ItemDto[]> {
    return this.prisma.artifact.findMany({ select: itemSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }

  async createItem(input: CreateItemDto): Promise<ItemDto> {
    return this.prisma.artifact.create({
      data: { name: input.name, type: input.type, department: input.department,
        description: input.description ?? null, content: input.content ?? null },
      select: itemSelect,
    });
  }

  async updateItem(id: string, input: UpdateItemDto): Promise<ItemDto> {
    if (Object.keys(input).length === 0) throw new BadRequestException('At least one item field must be provided');
    if (!await this.prisma.artifact.findUnique({ where: { id }, select: { id: true } })) {
      throw new NotFoundException(`Item ${id} not found`);
    }
    return this.prisma.artifact.update({ where: { id }, data: input, select: itemSelect });
  }

  async deleteItem(id: string): Promise<void> {
    try {
      await this.prisma.artifact.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException(`Item ${id} not found`);
      }
      throw error;
    }
  }
}
