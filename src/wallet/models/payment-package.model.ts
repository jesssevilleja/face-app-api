import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class PaymentPackage {
  @Field()
  id: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  credits: number;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field()
  allowMultiple: boolean;
}

@ObjectType()
export class PaymentIntent {
  @Field()
  transactionId: string;

  @Field({ nullable: true })
  paypalOrderId?: string;

  @Field({ nullable: true })
  gcashPaymentId?: string;

  @Field({ nullable: true })
  qrCode?: string;
}