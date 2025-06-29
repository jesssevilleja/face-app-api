import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from './models/product.model';
import { Category } from './models/category.model';
import { UserProduct, PurchaseResponse } from './models/user-product.model';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(
    private productsService: ProductsService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // Public queries
  @Query(() => [Product])
  async products(
    @Args('categoryId', { nullable: true }) categoryId?: string,
    @Args('search', { nullable: true }) search?: string,
  ): Promise<Product[]> {
    this.logger.info('Processing products query', { categoryId, search });
    return this.productsService.findAllProducts(categoryId, search);
  }

  @Query(() => [Category])
  async categories(): Promise<Category[]> {
    this.logger.info('Processing categories query');
    return this.productsService.findAllCategories();
  }

  @Query(() => [Category])
  async parentCategories(): Promise<Category[]> {
    this.logger.info('Processing parentCategories query');
    return this.productsService.findAllParentCategories();
  }

  // User queries (require authentication)
  @UseGuards(JwtAuthGuard)
  @Query(() => [UserProduct])
  async userProducts(@CurrentUser() user: any): Promise<UserProduct[]> {
    this.logger.info('Processing userProducts query', { userId: user.id });
    return this.productsService.findUserProducts(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => PurchaseResponse)
  async purchaseProduct(
    @Args('productId') productId: string,
    @CurrentUser() user: any,
  ): Promise<PurchaseResponse> {
    this.logger.info('Processing purchaseProduct mutation', {
      userId: user.id,
      productId,
    });
    return this.productsService.purchaseProduct(user.id, productId);
  }

  // Admin queries and mutations
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => [Product])
  async adminProducts(): Promise<Product[]> {
    this.logger.info('Processing adminProducts query');
    return this.productsService.findAllProductsAdmin();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => Product)
  async createProduct(
    @Args('input') createProductInput: CreateProductInput,
  ): Promise<Product> {
    this.logger.info('Processing createProduct mutation', { input: createProductInput });
    return this.productsService.createProduct(createProductInput);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => Product)
  async updateProduct(
    @Args('id') id: string,
    @Args('input') updateProductInput: UpdateProductInput,
  ): Promise<Product> {
    this.logger.info('Processing updateProduct mutation', { id, input: updateProductInput });
    return this.productsService.updateProduct(id, updateProductInput);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => Boolean)
  async deleteProduct(@Args('id') id: string): Promise<boolean> {
    this.logger.info('Processing deleteProduct mutation', { id });
    return this.productsService.deleteProduct(id);
  }
}