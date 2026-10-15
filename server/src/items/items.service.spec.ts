import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ArtifactType } from '../generated/prisma/enums.js';
import { ItemsService } from './items.service.js';

const item = { id: 'i1', name: 'Procedure', type: ArtifactType.PROCEDURE, department: 'Ward', description: null, content: null };
function setup() {
  const prisma = { artifact: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } };
  return { service: new ItemsService(prisma as never), prisma };
}

describe('ItemsService', () => {
  it('returns empty lists and orders names then ids', async () => {
    const { service, prisma } = setup();
    prisma.artifact.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([item]);
    expect(await service.listItems()).toEqual([]);
    expect(prisma.artifact.findMany).toHaveBeenLastCalledWith({ select: expect.any(Object), orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    await service.listItems();
  });

  it('creates with public mapping and null-normalized optional fields', async () => {
    const { service, prisma } = setup();
    prisma.artifact.create.mockResolvedValue(item);
    expect(await service.createItem({ name: 'Procedure', type: ArtifactType.PROCEDURE, department: 'Ward' })).toEqual(item);
    expect(prisma.artifact.create).toHaveBeenCalledWith({ data: { name: 'Procedure', type: ArtifactType.PROCEDURE, department: 'Ward', description: null, content: null }, select: expect.any(Object) });
  });

  it('accepts each contract artifact type in create and update DTO definitions', () => {
    expect(Object.values(ArtifactType)).toEqual(['FORM', 'PROCEDURE', 'CHECKLIST', 'TRAINING_MATERIAL', 'DEPARTMENT_INSTRUCTION', 'INFORMATION_SHEET']);
  });

  it('partially updates only supplied fields', async () => {
    const { service, prisma } = setup();
    prisma.artifact.findUnique.mockResolvedValue({ id: 'i1' });
    prisma.artifact.update.mockResolvedValue({ ...item, description: 'Updated' });
    await service.updateItem('i1', { description: 'Updated' });
    expect(prisma.artifact.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { description: 'Updated' }, select: expect.any(Object) });
  });

  it('rejects empty patch', async () => {
    const { service } = setup();
    await expect(service.updateItem('i1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for missing patch', async () => {
    const { service, prisma } = setup();
    prisma.artifact.findUnique.mockResolvedValue(null);
    await expect(service.updateItem('missing', { name: 'Changed' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes by Artifact id and delegates cascading edge deletion to database', async () => {
    const { service, prisma } = setup();
    prisma.artifact.delete.mockResolvedValue(item);
    await expect(service.deleteItem('i1')).resolves.toBeUndefined();
    expect(prisma.artifact.delete).toHaveBeenCalledWith({ where: { id: 'i1' } });
  });
});
