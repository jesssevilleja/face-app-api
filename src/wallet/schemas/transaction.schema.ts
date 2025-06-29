import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

export enum TransactionType {
  DEPOSIT = 'DEPOSIT',
  DEBIT = 'DEBIT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
}

export enum PaymentProvider {
  PAYPAL = 'PAYPAL',
  GCASH = 'GCASH',
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Transaction {
  @Prop()
  id: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Wallet', required: true })
  walletId: string;

  @Prop({ required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ required: true })
  amount: number; // Amount in USD

  @Prop({ required: true })
  credits: number; // Credits added/deducted

  @Prop({ required: true, enum: TransactionStatus, default: TransactionStatus.PENDING })
  status: TransactionStatus;

  @Prop({ enum: PaymentProvider })
  paymentProvider?: PaymentProvider;

  @Prop()
  transactionId?: string; // User-provided transaction ID

  @Prop()
  packageType?: string; // '5', '10', '15'

  @Prop({ default: 1 })
  multiplier: number; // For $15 package multiple orders

  @Prop()
  description?: string;

  @Prop()
  adminNote?: string; // Admin notes for processing

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  processedBy?: string; // Admin who processed the transaction

  @Prop()
  processedAt?: Date; // When the transaction was processed

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);