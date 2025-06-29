import { ObjectType, Field, ID, Int } from '@nestjs/graphql';
import { Product } from './product.model';

@ObjectType()
export class UserProduct {
  @Field(() => ID)
  id: string;

  @Field(() => Product)
  product: Product;

  @Field()
  purchaseDate: Date;

  @Field()
  isUsed: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class PurchaseResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => Int)
  newBalance: number;
}
