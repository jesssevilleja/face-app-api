import { Field, ObjectType, Int } from '@nestjs/graphql';
import { User } from './user.model';

@ObjectType()
export class UserStats extends User {
  @Field(() => Int)
  totalViews: number;

  @Field(() => Int)
  totalLikes: number;

  @Field(() => Int)
  totalFaces: number;
}