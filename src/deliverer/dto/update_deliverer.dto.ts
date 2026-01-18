import { IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class UpdateDelivererProfileDto {
  @IsOptional()
  @IsNumber()
  currentLat?: number;

  @IsOptional()
  @IsNumber()
  currentLng?: number;

  @IsOptional()
  @IsBoolean()
  availability?: boolean;
}