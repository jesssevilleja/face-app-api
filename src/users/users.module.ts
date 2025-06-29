import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { Face, FaceSchema } from '../faces/schemas/face.schema';
import { UsersService } from './users.service';
import { UsersResolver } from './users.resolver';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Face.name, schema: FaceSchema },
    ]),
  ],
  providers: [UsersService, UsersResolver, JwtService, ConfigService],
  exports: [UsersService],
})
export class UsersModule {}