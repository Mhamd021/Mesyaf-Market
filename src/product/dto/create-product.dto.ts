import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Condition } from '../../common/enums/condition.enum';

export class CreateProductDto {
    @IsString()
    name: string;

    @IsNumber()
    categoryId: number;

    @IsOptional()
    @IsString()
    description?: string;


    @IsEnum(Condition)
    condition: Condition;

    @Min(0)
    @IsNumber()
    price: number;
    @Min(0)
    @IsNumber()
    @IsOptional()
    discountPrice?: number;

    @Min(0)
    @IsOptional()
    @IsNumber()
    stockQuantity?: number;

    @IsBoolean()
    isAvailable: boolean;


}