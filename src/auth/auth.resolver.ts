import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResponse } from './models/auth.model';
import { LoginInput } from './dto/login.input';
import { CreateUserInput } from '../users/dto/create-user.input';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../users/schemas/user.schema';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Resolver()
export class AuthResolver {
  constructor(
    private authService: AuthService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  @Mutation(() => AuthResponse)
  async signup(
    @Args('input') createUserInput: CreateUserInput,
  ): Promise<AuthResponse> {
    this.logger.info('Processing signup request', {
      email: createUserInput.email,
    });
    return this.authService.signup(createUserInput);
  }

  @UseGuards(LocalAuthGuard)
  @Mutation(() => AuthResponse)
  async login(
    @Args('input') loginInput: LoginInput,
    @CurrentUser() user: User,
  ): Promise<AuthResponse> {
    this.logger.info('Processing login request', { email: loginInput.email });
    return this.authService.login(user);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Boolean)
  async logout(@CurrentUser() user: User): Promise<boolean> {
    this.logger.info('Processing logout request', { userId: user.id });
    return this.authService.logout(user.id);
  }

  @Mutation(() => AuthResponse)
  async refreshTokens(
    @Args('userId') userId: string,
    @Args('refreshToken') refreshToken: string,
  ): Promise<AuthResponse> {
    this.logger.info('Processing refreshTokens request', {
      userId: userId,
      refreshToken: refreshToken,
    });
    return this.authService.refreshTokens(userId, refreshToken);
  }
}
