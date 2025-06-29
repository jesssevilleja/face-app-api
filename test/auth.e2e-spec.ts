import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { CreateUserInput } from '../src/users/dto/create-user.input';
import { LoginInput } from '../src/auth/dto/login.input';
import { App } from 'supertest/types';

// Setup for mongodb-memory-server
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { User, UserDocument, UserSchema } from '../src/users/schemas/user.schema'; // Assuming UserDocument for Model typing
import { Model } from 'mongoose';

// Imports for full module setup
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from '../src/config/logger.config';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
// TodosModule is not directly tested here, so might not be needed unless AuthModule or UsersModule depends on it indirectly

describe('AuthResolver (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: any;
  let mongod: MongoMemoryServer;
  let userModel: Model<UserDocument>;

  const graphqlEndpoint = '/graphql';

  const testUser = {
    email: 'auth-e2e-user@example.com', // Unique email for this test suite
    password: 'password123',
    name: 'AuthE2EUser',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            MONGODB_URI: uri,
            JWT_SECRET: 'test_shared_secret_for_auth_e2e',
            JWT_ACCESS_SECRET: 'test_shared_secret_for_auth_e2e',
            JWT_REFRESH_SECRET: 'test_refresh_secret_for_auth_e2e',
            JWT_EXPIRATION: '15m',
            JWT_ACCESS_EXPIRATION: '15m',
            JWT_REFRESH_EXPIRATION: '7d',
            GOOGLE_CLIENT_ID: 'test_google_client_id_for_auth_e2e',
            GOOGLE_CLIENT_SECRET: 'test_google_client_secret_for_auth_e2e',
            GOOGLE_CALLBACK_URL: 'http://localhost:4001/auth/google/callback_for_auth_e2e',
          })],
        }),
        WinstonModule.forRoot(loggerConfig),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => ({
            uri: configService.get<string>('MONGODB_URI'),
          }),
        }),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: true,
          context: ({ req }) => ({ req }),
        }),
        AuthModule,
        UsersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();
    httpServer = app.getHttpServer();
    userModel = moduleFixture.get<Model<UserDocument>>(getModelToken(User.name));
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    // Clean up users before each test in this describe block
    if (userModel) {
      await userModel.deleteMany({});
    }
  });

  describe('signup', () => {
    it('should create a new user and return tokens', async () => {
      const createUserInput: CreateUserInput = {
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      };

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .send({
          query: `
            mutation Signup($input: CreateUserInput!) {
              signup(input: $input) {
                accessToken
                refreshToken
                user {
                  id
                  email
                  name # Changed from username
                }
              }
            }
          `,
          variables: { input: createUserInput },
        })
        .expect(200);

      const data = response.body.data.signup;
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.user.email).toBe(testUser.email);
      expect(data.user.name).toBe(testUser.name); // Changed from username
    });

    it('should return an error if email already exists', async () => {
      // First, create the user
      await userModel.create({
        email: testUser.email,
        password: testUser.password, // Password will be hashed by service/schema pre-save hook if any
        name: testUser.name
      });

      const createUserInput: CreateUserInput = {
        email: testUser.email, // Same email
        password: 'anotherpassword',
        name: 'anotheruser',
      };

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .send({
          query: `
            mutation Signup($input: CreateUserInput!) {
              signup(input: $input) {
                accessToken
              }
            }
          `,
          variables: { input: createUserInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      // This message might vary based on how your unique constraint violation is handled
      expect(response.body.errors[0].message).toMatch(/User with this email already exists|unique constraint/i);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Ensure the user exists before trying to log in
      // Note: In a real scenario, UsersService.create would handle password hashing.
      // Here, we are creating directly for test setup. If UserSchema has a pre-save hook for hashing, it will apply.
      // If not, and login compares hashed passwords, this might need adjustment or use UsersService.
      const createUserInput: CreateUserInput = {
        email: testUser.email,
        password: testUser.password,
        name: testUser.name,
      };
      // Using the signup mutation to create the user to ensure password hashing if service does it
      await request(httpServer)
        .post(graphqlEndpoint)
        .send({
          query: `
            mutation Signup($input: CreateUserInput!) {
              signup(input: $input) { user { id } }
            }
          `,
          variables: { input: createUserInput },
        });
    });

    it('should login an existing user and return tokens', async () => {
      const loginInput: LoginInput = {
        email: testUser.email,
        password: testUser.password,
      };

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                accessToken
                refreshToken
                user {
                  id
                  email
                  name # Changed from username
                }
              }
            }
          `,
          variables: { input: loginInput },
        })
        .expect(200);

      const data = response.body.data.login;
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.user.email).toBe(testUser.email);
      expect(data.user.name).toBe(testUser.name); // Changed from username
    });

    it('should return an error for invalid credentials', async () => {
      const loginInput: LoginInput = {
        email: testUser.email,
        password: 'wrongpassword',
      };

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                accessToken
              }
            }
          `,
          variables: { input: loginInput },
        })
        .expect(200);

      expect(response.body.errors).toBeDefined();
      // Updated to accept "Invalid email or password" as seen in previous test output.
      expect(response.body.errors[0].message).toMatch(/Unauthorized|Invalid credentials|Invalid email or password/i);
    });
  });
});
