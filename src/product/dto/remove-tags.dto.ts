import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class RemoveTagsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  tagIds: number[];
}
