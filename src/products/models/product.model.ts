import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { Category } from './category.model';

@ObjectType()
export class Product {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Int)
  price: number;

  @Field()
  imageUrl: string;

  @Field(() => Category)
  category: Category;

  @Field()
  isPopular: boolean;

  @Field(() => Float)
  rating: number;

  @Field()
  isActive: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}