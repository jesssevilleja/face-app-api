import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet, WalletDocument } from './schemas/wallet.schema';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
  TransactionStatus,
  PaymentProvider,
} from './schemas/transaction.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreatePaymentIntentInput } from './dto/create-payment-intent.input';
import { ConfirmPaymentInput } from './dto/confirm-payment.input';
import {
  ProcessTransactionInput,
  TransactionAction,
} from './dto/process-transaction.input';
import { PaymentService } from './payment.service';

@Injectable()
export class WalletService {
  private readonly packages = {
    '5': { price: 5, credits: 200 },
    '10': { price: 10, credits: 500 },
    '15': { price: 15, credits: 800 },
  };

  constructor(
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private paymentService: PaymentService,
  ) {}

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    let wallet = await this.walletModel.findOne({ userId }).exec();

    if (!wallet) {
      wallet = new this.walletModel({ userId, credits: 0 });
      await wallet.save();
    }

    return wallet.toJSON();
  }

  async getWalletByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletModel.findOne({ userId }).exec();
    if (!wallet) {
      return this.getOrCreateWallet(userId);
    }
    return wallet.toJSON();
  }

  getPaymentPackages() {
    return Object.entries(this.packages).map(([id, pkg]) => ({
      id,
      price: pkg.price,
      credits: pkg.credits,
      name: `$${pkg.price} Package`,
      description: `Get ${pkg.credits} credits for $${pkg.price}`,
      allowMultiple: id === '15',
    }));
  }

  async createPaymentIntent(userId: string, input: CreatePaymentIntentInput) {
    const {
      packageType,
      paymentProvider,
      multiplier = 1,
      transactionId,
    } = input;

    if (!this.packages[packageType]) {
      throw new BadRequestException('Invalid package type');
    }

    // Only allow multiplier for $15 package
    if (packageType !== '15' && multiplier > 1) {
      throw new BadRequestException(
        'Multiple orders only allowed for $15 package',
      );
    }

    // Check if transaction ID already exists
    const existingTransaction = await this.transactionModel
      .findOne({
        transactionId,
        userId,
      })
      .exec();

    if (existingTransaction) {
      throw new BadRequestException('Transaction ID already exists');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const packageInfo = this.packages[packageType];
    const totalAmount = packageInfo.price * multiplier;
    const totalCredits = packageInfo.credits * multiplier;

    // Create transaction record
    const newTransaction = new this.transactionModel({
      userId,
      walletId: wallet.id,
      type: TransactionType.DEPOSIT,
      amount: totalAmount,
      credits: totalCredits,
      status: TransactionStatus.PENDING,
      paymentProvider,
      transactionId,
      packageType,
      multiplier,
      description: `Purchase ${multiplier}x $${packageType} package${multiplier > 1 ? 's' : ''} - Transaction ID: ${transactionId}`,
    });

    const transaction = (await newTransaction.save()).toJSON();
    // Create payment intent based on provider
    let paymentIntent;
    switch (paymentProvider) {
      case PaymentProvider.PAYPAL:
        paymentIntent = await this.paymentService.createPayPalOrder(
          totalAmount,
          transaction.id,
          transactionId,
        );
        break;
      case PaymentProvider.GCASH:
        paymentIntent = await this.paymentService.createGCashPayment(
          totalAmount,
          transaction.id,
          transactionId,
        );
        break;
      default:
        throw new BadRequestException('Unsupported payment provider');
    }

    return {
      transactionId: transaction.id,
      paypalOrderId: paymentIntent.paypalOrderId,
      gcashPaymentId: paymentIntent.gcashPaymentId,
      qrCode: paymentIntent.qrCode,
    };
  }

  async confirmPayment(userId: string, input: ConfirmPaymentInput) {
    const transaction = await this.transactionModel
      .findOne({
        _id: input.transactionId,
        userId,
        status: TransactionStatus.PENDING,
      })
      .exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found or already processed');
    }

    // Verify payment based on provider
    let isPaymentSuccessful = false;
    switch (transaction.paymentProvider) {
      case PaymentProvider.PAYPAL:
        if (transaction.transactionId)
          isPaymentSuccessful = await this.paymentService.verifyPayPalPayment(
            `paypal_order_${transaction.id}`,
            transaction.transactionId,
          );
        break;
      case PaymentProvider.GCASH:
        if (transaction.transactionId)
          isPaymentSuccessful = await this.paymentService.verifyGCashPayment(
            `gcash_payment_${transaction.id}`,
            transaction.transactionId,
          );
        break;
    }

    if (isPaymentSuccessful) {
      // Mark transaction as pending admin approval
      await this.transactionModel.findByIdAndUpdate(transaction.id, {
        status: TransactionStatus.PENDING, // Keep as pending for admin approval
      });

      return true;
    } else {
      // Mark transaction as failed
      await this.transactionModel.findByIdAndUpdate(transaction.id, {
        status: TransactionStatus.FAILED,
      });

      throw new BadRequestException('Payment verification failed');
    }
  }

  async getTransactionHistory(userId: string, limit = 10, offset = 0) {
    const transactions = await this.transactionModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();

    const totalCount = await this.transactionModel.countDocuments({ userId });

    return {
      transactions: transactions.map((t) => t.toJSON()),
      totalCount,
      hasMore: offset + transactions.length < totalCount,
    };
  }

  async deductCredits(userId: string, credits: number, description: string) {
    const wallet = await this.getWalletByUserId(userId);

    if (wallet.credits < credits) {
      throw new BadRequestException('Insufficient credits');
    }

    // Create debit transaction
    const transaction = new this.transactionModel({
      userId,
      walletId: wallet.id,
      type: TransactionType.DEBIT,
      amount: 0, // No monetary amount for debit
      credits,
      status: TransactionStatus.COMPLETED,
      description,
    });

    await transaction.save();

    // Deduct credits from wallet
    await this.walletModel.findByIdAndUpdate(wallet.id, {
      $inc: { credits: -credits },
    });

    return transaction.toJSON();
  }

  // Admin methods
  async getAdminTransactions(limit = 20, offset = 0, status?: string) {
    const filter: any = { type: TransactionType.DEPOSIT };

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    const transactions = await this.transactionModel
      .find(filter)
      .populate('userId', 'name email')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .exec();

    const totalCount = await this.transactionModel.countDocuments(filter);

    const adminTransactions = transactions.map((transaction) => {
      const user = transaction.userId as any;
      const processedBy = transaction.processedBy as any;

      return {
        ...transaction.toJSON(),
        userName: user?.name || 'Unknown',
        userEmail: user?.email || 'Unknown',
        processedBy: processedBy?.name || null,
      };
    });

    return {
      transactions: adminTransactions,
      totalCount,
      hasMore: offset + transactions.length < totalCount,
    };
  }

  async getTransactionStats() {
    const [
      totalTransactions,
      pendingTransactions,
      completedTransactions,
      rejectedTransactions,
      revenueStats,
    ] = await Promise.all([
      this.transactionModel.countDocuments({ type: TransactionType.DEPOSIT }),
      this.transactionModel.countDocuments({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      }),
      this.transactionModel.countDocuments({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.COMPLETED,
      }),
      this.transactionModel.countDocuments({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.REJECTED,
      }),
      this.transactionModel.aggregate([
        { $match: { type: TransactionType.DEPOSIT } },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueStats
      .filter((stat) => stat._id === TransactionStatus.COMPLETED)
      .reduce((sum, stat) => sum + stat.totalAmount, 0);

    const pendingRevenue = revenueStats
      .filter((stat) => stat._id === TransactionStatus.PENDING)
      .reduce((sum, stat) => sum + stat.totalAmount, 0);

    return {
      totalTransactions,
      pendingTransactions,
      completedTransactions,
      rejectedTransactions,
      totalRevenue,
      pendingRevenue,
    };
  }

  async processTransaction(input: ProcessTransactionInput, adminId: string) {
    const { transactionId, action, adminNote } = input;

    const transaction = await this.transactionModel
      .findOne({
        _id: transactionId,
        status: TransactionStatus.PENDING,
        type: TransactionType.DEPOSIT,
      })
      .exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found or already processed');
    }

    if (action === TransactionAction.APPROVE) {
      // Update transaction status
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: TransactionStatus.COMPLETED,
        adminNote,
        processedBy: adminId,
        processedAt: new Date(),
      });

      // Add credits to wallet
      await this.walletModel.findByIdAndUpdate(transaction.walletId, {
        $inc: { credits: transaction.credits },
      });
    } else if (action === TransactionAction.REJECT) {
      // Update transaction status
      await this.transactionModel.findByIdAndUpdate(transactionId, {
        status: TransactionStatus.REJECTED,
        adminNote,
        processedBy: adminId,
        processedAt: new Date(),
      });
    }

    return true;
  }
}
