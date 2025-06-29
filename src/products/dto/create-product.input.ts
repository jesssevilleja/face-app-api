import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, IsUrl, IsBoolean, IsOptional, Min } from 'class-validator';

@InputType()
export class CreateProductInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  name: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  description: string;

  @Field(() => Int)
  @IsNumber()
  @Min(1)
  price: number;

  @Field()
  @IsUrl()
  imageUrl: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  categoryId: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;
}