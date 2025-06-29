import { InputType, Field, Int } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsPositive, Min, IsString } from 'class-validator';
import { PaymentProvider } from '../schemas/transaction.schema';

@InputType()
export class CreatePaymentIntentInput {
  @Field()
  @IsNotEmpty()
  packageType: string; // '5', '10', '15'

  @Field(() => PaymentProvider)
  @IsEnum(PaymentProvider)
  paymentProvider: PaymentProvider;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @IsOptional()
  @IsPositive()
  @Min(1)
  multiplier?: number;

  @Field()
  @IsNotEmpty()
  @IsString()
  transactionId: string; // User-provided transaction ID
}