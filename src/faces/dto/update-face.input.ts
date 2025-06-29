import { InputType, Field } from '@nestjs/graphql';
import { IsOptional, IsString, IsArray } from 'class-validator';

@InputType()
export class UpdateFaceInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  expression?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  style?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  makeup?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  accessories?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  productsUsed?: string[];
}