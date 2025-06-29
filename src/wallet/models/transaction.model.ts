import { Field, ID, ObjectType, Int, Float, registerEnumType } from '@nestjs/graphql';
import { TransactionType, TransactionStatus, PaymentProvider } from '../schemas/transaction.schema';

registerEnumType(TransactionType, {
  name: 'TransactionType',
});

registerEnumType(TransactionStatus, {
  name: 'TransactionStatus',
});

registerEnumType(PaymentProvider, {
  name: 'PaymentProvider',
});

@ObjectType()
export class Transaction {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  walletId: string;

  @Field(() => TransactionType)
  type: TransactionType;

  @Field(() => Float)
  amount: number;

  @Field(() => Int)
  credits: number;

  @Field(() => TransactionStatus)
  status: TransactionStatus;

  @Field(() => PaymentProvider, { nullable: true })
  paymentProvider?: PaymentProvider;

  @Field({ nullable: true })
  transactionId?: string;

  @Field({ nullable: true })
  packageType?: string;

  @Field(() => Int)
  multiplier: number;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}