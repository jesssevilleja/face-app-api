import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';

@InputType()
export class CreateFaceInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  imageUrl: string;

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