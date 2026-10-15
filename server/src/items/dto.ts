import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ArtifactType } from '../generated/prisma/enums.js';

export class CreateItemDto {
  @IsString() @Matches(/\S/) name!: string;
  @IsEnum(ArtifactType) type!: ArtifactType;
  @IsString() @Matches(/\S/) department!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() content?: string;
}

export class UpdateItemDto {
  @IsOptional() @IsString() @Matches(/\S/) name?: string;
  @IsOptional() @IsEnum(ArtifactType) type?: ArtifactType;
  @IsOptional() @IsString() @Matches(/\S/) department?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() content?: string;
}

export interface ItemDto {
  id: string;
  name: string;
  type: ArtifactType;
  department: string;
  description: string | null;
  content: string | null;
}
