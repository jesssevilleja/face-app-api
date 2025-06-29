import { Field, ObjectType, Int, Float } from '@nestjs/graphql';
import { Transaction } from './transaction.model';

@ObjectType()
export class AdminTransaction extends Transaction {
  @Field({ nullable: true })
  adminNote?: string;

  @Field({ nullable: true })
  processedBy?: string;

  @Field({ nullable: true })
  processedAt?: Date;

  @Field()
  userName: string;

  @Field()
  userEmail: string;
}

@ObjectType()
export class AdminTransactionConnection {
  @Field(() => [AdminTransaction])
  transactions: AdminTransaction[];

  @Field(() => Int)
  totalCount: number;

  @Field()
  hasMore: boolean;
}

@ObjectType()
export class TransactionStats {
  @Field(() => Int)
  totalTransactions: number;

  @Field(() => Int)
  pendingTransactions: number;

  @Field(() => Int)
  completedTransactions: number;

  @Field(() => Int)
  rejectedTransactions: number;

  @Field(() => Float)
  totalRevenue: number;

  @Field(() => Float)
  pendingRevenue: number;
}