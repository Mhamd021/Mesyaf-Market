import { IsOptional, IsInt, IsString, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  tagIds?: number[];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;
}
