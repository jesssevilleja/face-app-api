import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Category, CategoryDocument } from './schemas/category.schema';
import {
  UserProduct,
  UserProductDocument,
} from './schemas/user-product.schema';
import { CreateProductInput } from './dto/create-product.input';
import { UpdateProductInput } from './dto/update-product.input';
import { Product as ProductModel } from './models/product.model';
import { Category as CategoryModel } from './models/category.model';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(UserProduct.name)
    private userProductModel: Model<UserProductDocument>,
  ) {}

  // Product CRUD Operations
  async createProduct(
    createProductInput: CreateProductInput,
  ): Promise<ProductModel> {
    const category = await this.categoryModel.findById(
      createProductInput.categoryId,
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const product = new this.productModel(createProductInput);
    const savedProduct = await product.save();
    return this.findProductById(savedProduct.id);
  }

  async findAllProducts(
    categoryId?: string,
    search?: string,
  ): Promise<ProductModel[]> {
    const query: any = { isActive: true };

    if (categoryId) {
      // Check if categoryId is a parent category
      const category = await this.categoryModel.findById(categoryId);
      if (category?.isParent) {
        // Find all child categories under this parent
        const childCategories = await this.categoryModel.find({
          parentId: categoryId,
          isActive: true,
        });
        const categoryIds = childCategories.map((cat) => cat._id);
        query.categoryId = { $in: categoryIds };
      } else {
        query.categoryId = new Types.ObjectId(categoryId);
      }
    }

    if (search) {
      query.$text = { $search: search };
    }

    const products = await this.productModel
      .find(query)
      .populate({
        path: 'categoryId',
        populate: {
          path: 'parentId',
        },
      })
      .sort({ isPopular: -1, rating: -1, createdAt: -1 })
      .exec();

    return products.map((product) => this.transformProduct(product.toJSON()));
  }

  async findProductById(id: string): Promise<ProductModel> {
    const product = await this.productModel
      .findById(id)
      .populate({
        path: 'categoryId',
        populate: {
          path: 'parentId',
        },
      })
      .exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.transformProduct(product.toJSON());
  }

  async updateProduct(
    id: string,
    updateProductInput: UpdateProductInput,
  ): Promise<ProductModel> {
    const product = await this.productModel
      .findByIdAndUpdate(id, updateProductInput, { new: true })
      .exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.findProductById(id);
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await this.productModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();

    return !!result;
  }

  // Admin methods
  async findAllProductsAdmin(): Promise<ProductModel[]> {
    const products = await this.productModel
      .find()
      .populate({
        path: 'categoryId',
        populate: {
          path: 'parentId',
        },
      })
      .sort({ createdAt: -1 })
      .exec();

    return products.map((product) => this.transformProduct(product.toJSON()));
  }

  // Category Operations
  async findAllCategories(): Promise<CategoryModel[]> {
    const categories = await this.categoryModel
      .find({ isActive: true, isParent: false })
      .populate('parentId')
      .exec();
    return categories.map((category) =>
      this.transformCategory(category.toJSON()),
    );
  }

  async findAllParentCategories(): Promise<CategoryModel[]> {
    const parentCategories = await this.categoryModel
      .find({ isActive: true, isParent: true })
      .exec();

    return parentCategories.map((pc) => pc.toJSON());
  }

  // User Product Operations
  async purchaseProduct(
    userId: string,
    productId: string,
  ): Promise<{ success: boolean; message: string; newBalance: number }> {
    // Check if user already owns this product
    const existingUserProduct = await this.userProductModel.findOne({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
    });

    if (existingUserProduct) {
      throw new BadRequestException('You already own this product');
    }

    // Get product details
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // This would integrate with the wallet service to deduct credits
    // For now, we'll assume the wallet service handles the credit deduction
    // and returns the new balance

    // Create user product record
    const userProduct = new this.userProductModel({
      userId,
      productId,
      purchaseDate: new Date(),
    });

    await userProduct.save();

    return {
      success: true,
      message: 'Product purchased successfully',
      newBalance: 0, // This should come from wallet service
    };
  }

  async findUserProducts(userId: string): Promise<any[]> {
    const userProducts = await this.userProductModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate({
        path: 'productId',
        populate: {
          path: 'categoryId',
          populate: {
            path: 'parentId',
          },
        },
      })
      .sort({ purchaseDate: -1 })
      .exec();

    return userProducts.map((up) => {
      const userProductJson = up.toJSON();
      return {
        id: userProductJson.id,
        product: this.transformProduct(userProductJson.productId),
        purchaseDate: userProductJson.purchaseDate,
        isUsed: userProductJson.isUsed,
        createdAt: userProductJson.createdAt,
        updatedAt: userProductJson.updatedAt,
      };
    });
  }

  // Helper methods
  private transformProduct(product: any): ProductModel {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl,
      category: this.transformCategory(product.categoryId),
      isPopular: product.isPopular,
      rating: product.rating,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private transformCategory(category: any): CategoryModel {
    const result: CategoryModel = {
      id: category.id,
      name: category.name,
      isParent: category.isParent,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };

    if (category.parentId && !category.isParent) {
      result.parentCategory = {
        id: category.parentId.id,
        name: category.parentId.name,
        isParent: category.parentId.isParent,
        isActive: category.parentId.isActive,
        createdAt: category.parentId.createdAt,
        updatedAt: category.parentId.updatedAt,
      };
    }

    return result;
  }
}
