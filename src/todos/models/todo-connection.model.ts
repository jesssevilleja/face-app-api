import { Field, ObjectType, Int } from '@nestjs/graphql';
import { Todo } from './todo.model';

@ObjectType()
export class TodoConnection {
  @Field(() => [Todo])
  todos: Todo[];

  @Field(() => Int)
  totalCount: number;

  @Field()
  hasMore: boolean;
}