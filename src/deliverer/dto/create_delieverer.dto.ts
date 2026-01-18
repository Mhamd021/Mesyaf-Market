// create-deliverer-profile.dto.ts
import { IsInt } from 'class-validator';

export class CreateDelivererProfileDto {
  @IsInt()
  userId: number; 
}
