import { IsArray, IsNumber } from "class-validator";

export class AssignTagsDto {
  @IsArray() @IsNumber({}, { each: true }) tagIds: number[];
}
