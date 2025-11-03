import { PartialType } from '@nestjs/mapped-types';
import { CreateVendorProfileDto } from './create-vendor-profile.dto';

export class UpdateVendorProfileDto extends PartialType(CreateVendorProfileDto) {}
