import { InputType, Field, Int } from '@nestjs/graphql';

@InputType()
export class AllFacesInput {
  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  limit: number;

  @Field(() => String, { nullable: true })
  searchTerm?: string;

  @Field(() => String, { nullable: true })
  sortBy?: string;

  @Field(() => String, { nullable: true })
  sortOrder?: string;

  @Field(() => String, { nullable: true })
  userId?: string;
}