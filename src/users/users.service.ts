import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { Face, FaceDocument } from '../faces/schemas/face.schema';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Face.name) private faceModel: Model<FaceDocument>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserInput: CreateUserInput): Promise<User> {
    const { password, ...rest } = createUserInput;

    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const newUser = new this.userModel({
      ...rest,
      password: hashedPassword,
    });

    const user = await newUser.save();
    return user?.toJSON();
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();
  }

  async updateProfile(id: string, updateUserInput: UpdateUserInput): Promise<User | null> {
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserInput, { new: true })
      .exec();
    return user ? user?.toJSON() : null;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    const user = await this.userModel.findOne({ email }).exec();
    return user ? user?.toJSON() : null;
  }

  async findOneById(id: string): Promise<User | null> {
    const user = await this.userModel.findById(id).exec();
    return user ? user?.toJSON() : null;
  }

  async findOneByGoogleId(googleId: string): Promise<User | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async findAllWithStats(
    page: number,
    limit: number,
    searchTerm?: string,
    sortBy?: string,
    sortOrder?: string,
  ) {
    const query: any = {};
    if (searchTerm) {
      query.name = { $regex: searchTerm, $options: 'i' };
    }

    const users = await this.userModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    // Get stats for each user
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const userFaces = await this.faceModel.find({ userId: user._id }).exec();
        
        const totalViews = userFaces.reduce((sum, face) => sum + face.views, 0);
        const totalLikes = userFaces.reduce((sum, face) => sum + face.likes, 0);
        const totalFaces = userFaces.length;

        return {
          ...user.toJSON(),
          totalViews,
          totalLikes,
          totalFaces,
        };
      })
    );

    // Sort the results
    if (sortBy) {
      usersWithStats.sort((a, b) => {
        const aValue = a[sortBy] || 0;
        const bValue = b[sortBy] || 0;
        
        if (sortOrder === 'desc') {
          return bValue - aValue;
        } else {
          return aValue - bValue;
        }
      });
    }

    return usersWithStats;
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findOneByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    return isPasswordValid ? user : null;
  }

  async setRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userModel.findByIdAndUpdate(userId, {
      refreshToken: hashedRefreshToken,
    });
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user || !user.refreshToken) return false;

    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT secret key is missing');
    }

    // Verify the token
    try {
      this.jwtService.verify(refreshToken, { secret }); // throws if expired or invalid
      // Token is valid and matches
    } catch (err) {
      this.removeRefreshToken(userId);
      throw err;
    }

    return await bcrypt.compare(refreshToken, user.refreshToken); // optional, if hashed
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      refreshToken: null,
    });
  }
}