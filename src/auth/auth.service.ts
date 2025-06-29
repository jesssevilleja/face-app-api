import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/schemas/user.schema';
import { CreateUserInput } from '../users/dto/create-user.input';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    return this.usersService.validateUser(email, password);
  }

  async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
      }),
    ]);

    await this.usersService.setRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async login(user: User) {
    return this.generateTokens(user);
  }

  async signup(createUserInput: CreateUserInput) {
    const existingUser = await this.usersService.findOneByEmail(
      createUserInput.email,
    );

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = await this.usersService.create(createUserInput);

    return this.generateTokens(user);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user || !user.refreshToken) {
      throw new Error('Access denied');
    }

    const refreshTokenMatches = await this.usersService.validateRefreshToken(
      userId,
      refreshToken,
    );

    if (!refreshTokenMatches) {
      throw new Error('Access denied');
    }

    return this.generateTokens(user);
  }

  async validateGoogleUser(profile: any): Promise<User> {
    const { id, emails, name, photos } = profile;
    const email = emails[0].value;

    let user = await this.usersService.findOneByGoogleId(id);

    if (!user) {
      user = await this.usersService.findOneByEmail(email);

      if (user) {
        // Update existing user with Google info
        await this.usersService.update(user.id, {
          googleId: id,
          isGoogleAccount: true,
        });
      } else {
        // Create new user
        const createUserInput: CreateUserInput = {
          name: `${name.givenName} ${name.familyName}`,
          email,
          googleId: id,
          isGoogleAccount: true,
          profilePicture: photos[0]?.value,
        };

        user = await this.usersService.create(createUserInput);
      }
    }

    return user;
  }

  async googleLogin(req) {
    if (!req.user) {
      throw new Error('No user from Google');
    }

    return this.login(req.user);
  }

  async logout(userId: string) {
    await this.usersService.removeRefreshToken(userId);
    return true;
  }
}
