import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { Inject, UseGuards } from '@nestjs/common';
import { User } from './models/user.model';
import { UserStats } from './models/user-stats.model';
import { UsersService } from './users.service';
import { UpdateUserInput } from './dto/update-user.input';
import { AllUsersInput } from './dto/all-users.input';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private usersService: UsersService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Query(() => User, { name: 'me' })
  async getMe(@CurrentUser() user: any): Promise<User | null> {
    this.logger.info('Processing findOneById request', {
      name: user.id,
    });
    return this.usersService.findOneById(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => User, { name: 'user', nullable: true })
  async getUser(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<User | null> {
    this.logger.info('Processing getUser request', {
      id: id,
    });
    return this.usersService.findOneById(id);
  }

  @Query(() => [UserStats], { name: 'allUsers' })
  async getAllUsers(
    @Args('input') input: AllUsersInput,
  ): Promise<UserStats[]> {
    this.logger.info('Processing getAllUsers request', {
      input,
    });
    const { page, limit, searchTerm, sortBy, sortOrder } = input;
    return this.usersService.findAllWithStats(
      page,
      limit,
      searchTerm,
      sortBy,
      sortOrder,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => User)
  async updateUser(
    @Args('input') updateUserInput: UpdateUserInput,
    @CurrentUser() user: any,
  ): Promise<User | null> {
    this.logger.info('Processing updateUser request', {
      userId: user.id,
      input: updateUserInput,
    });
    return this.usersService.updateProfile(user.id, updateUserInput);
  }
}