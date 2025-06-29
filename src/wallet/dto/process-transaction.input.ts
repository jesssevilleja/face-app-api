import { InputType, Field, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum TransactionAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

registerEnumType(TransactionAction, {
  name: 'TransactionAction', // This is the name that will be used in GraphQL schema
});

@InputType()
export class ProcessTransactionInput {
  @Field()
  @IsNotEmpty()
  transactionId: string;

  @Field(() => TransactionAction)
  @IsEnum(TransactionAction)
  action: TransactionAction;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  adminNote?: string;
}