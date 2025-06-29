import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class DeductCreditsResponse {
  @Field()
  success: boolean;

  @Field(() => Int)
  newBalance: number;
}
