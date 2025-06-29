import { Field, ID, ObjectType, Int } from '@nestjs/graphql';

@ObjectType()
export class Wallet {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field(() => Int)
  credits: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}