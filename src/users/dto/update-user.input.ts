import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

@InputType()
export class UpdateUserInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsUrl()
  profilePicture?: string;
}