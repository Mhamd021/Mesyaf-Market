import { IsInt, IsOptional, IsString, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsInt() productId: number;
  @IsInt() quantity: number;
  @IsNumber() price: number;
}

export class CreateOrderDto {

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional() @IsString() customerAddress?: string;
  @IsOptional() @IsNumber() customerLat?: number;
  @IsOptional() @IsNumber() customerLng?: number;
  
  @IsOptional() @IsInt() estimatedPrepTime?: number;
  @IsOptional() @IsInt() deliveryFee?: number;
}
