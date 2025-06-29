import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { Wallet } from './models/wallet.model';
import { Transaction } from './models/transaction.model';
import { PaymentPackage, PaymentIntent } from './models/payment-package.model';
import {
  AdminTransaction,
  AdminTransactionConnection,
  TransactionStats,
} from './models/admin-transaction.model';
import { CreatePaymentIntentInput } from './dto/create-payment-intent.input';
import { ConfirmPaymentInput } from './dto/confirm-payment.input';
import { ProcessTransactionInput } from './dto/process-transaction.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { DeductCreditsResponse } from './dto/deduct-credits.response';

@Resolver(() => Wallet)
@UseGuards(JwtAuthGuard)
export class WalletResolver {
  constructor(
    private walletService: WalletService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Query(() => Wallet)
  async myWallet(@CurrentUser() user: any): Promise<Wallet> {
    this.logger.info('Processing myWallet request', { userId: user.id });
    return this.walletService.getWalletByUserId(user.id);
  }

  @Query(() => [PaymentPackage])
  async paymentPackages(): Promise<PaymentPackage[]> {
    this.logger.info('Processing paymentPackages request');
    return this.walletService.getPaymentPackages();
  }

  @Mutation(() => PaymentIntent)
  async createPaymentIntent(
    @Args('input') input: CreatePaymentIntentInput,
    @CurrentUser() user: any,
  ): Promise<PaymentIntent> {
    this.logger.info('Processing createPaymentIntent request', {
      userId: user.id,
      packageType: input.packageType,
      paymentProvider: input.paymentProvider,
    });
    return this.walletService.createPaymentIntent(user.id, input);
  }

  @Mutation(() => Boolean)
  async confirmPayment(
    @Args('input') input: ConfirmPaymentInput,
    @CurrentUser() user: any,
  ): Promise<boolean> {
    this.logger.info('Processing confirmPayment request', {
      userId: user.id,
      transactionId: input.transactionId,
    });
    return this.walletService.confirmPayment(user.id, input);
  }

  @Query(() => [Transaction])
  async transactionHistory(
    @CurrentUser() user: any,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 10 })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
  ) {
    this.logger.info('Processing transactionHistory request', {
      userId: user.id,
      limit,
      offset,
    });
    const result = await this.walletService.getTransactionHistory(
      user.id,
      limit,
      offset,
    );
    return result.transactions;
  }

  @Mutation(() => DeductCreditsResponse)
  async deductCredits(
    @Args('amount', { type: () => Int }) amount: number,
    @Args('description') description: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean; newBalance: number }> {
    this.logger.info('Processing deductCredits request', {
      userId: user.id,
      amount,
      description,
    });

    try {
      await this.walletService.deductCredits(user.id, amount, description);
      const wallet = await this.walletService.getWalletByUserId(user.id);
      return { success: true, newBalance: wallet.credits };
    } catch (error) {
      this.logger.error('Failed to deduct credits', { error: error.message });
      throw error;
    }
  }

  // Admin-only endpoints
  @UseGuards(AdminGuard)
  @Query(() => AdminTransactionConnection)
  async adminTransactions(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
    @Args('status', { nullable: true }) status?: string,
  ): Promise<AdminTransactionConnection> {
    this.logger.info('Processing adminTransactions request', {
      limit,
      offset,
      status,
    });
    return this.walletService.getAdminTransactions(limit, offset, status);
  }

  @UseGuards(AdminGuard)
  @Query(() => TransactionStats)
  async transactionStats(): Promise<TransactionStats> {
    this.logger.info('Processing transactionStats request');
    return this.walletService.getTransactionStats();
  }

  @UseGuards(AdminGuard)
  @Mutation(() => Boolean)
  async processTransaction(
    @Args('input') input: ProcessTransactionInput,
    @CurrentUser() admin: any,
  ): Promise<boolean> {
    this.logger.info('Processing processTransaction request', {
      adminId: admin.id,
      transactionId: input.transactionId,
      action: input.action,
    });
    return this.walletService.processTransaction(input, admin.id);
  }
}
