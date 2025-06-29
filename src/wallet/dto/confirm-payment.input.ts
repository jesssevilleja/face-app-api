import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';

@InputType()
export class ConfirmPaymentInput {
  @Field()
  @IsNotEmpty()
  transactionId: string;
}