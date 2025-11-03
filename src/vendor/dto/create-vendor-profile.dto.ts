import { IsString, IsOptional, IsNumber, IsLatitude, IsLongitude, MaxLength } from 'class-validator';

export class CreateVendorProfileDto {
  @IsString()
  @MaxLength(50)
  shopName: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;
}
