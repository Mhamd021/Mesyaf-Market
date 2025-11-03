import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class AddProductImageDto {
  @IsUrl({ require_protocol: true })
  @IsString()
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;
}
