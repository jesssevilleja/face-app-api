import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common'; // Added ValidationPipe
import * as request from 'supertest';
import { App } from 'supertest/types';

// Setup for mongodb-memory-server
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose'; // MongooseModule for forRootAsync
import { User, UserSchema } from '../src/users/schemas/user.schema'; // Needed for MongooseModule.forFeature
import { Todo, TodoSchema } from '../src/todos/schemas/todo.schema'; // Needed for MongooseModule.forFeature


// Imports for full module setup
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { WinstonModule } from 'nest-winston';
import { loggerConfig } from '../src/config/logger.config';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { TodosModule } from '../src/todos/todos.module';
import { AppController } from '../src/app.controller'; // Import AppController
import { AppService } from '../src/app.service';     // Import AppService

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  // Changed from beforeEach to beforeAll for efficiency, as app setup can be slow.
  // If tests needed strict isolation of the Nest app instance, beforeEach would be better.
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      // Instead of importing full AppModule, we construct a similar environment
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({
            MONGODB_URI: uri,
            JWT_SECRET: 'test_shared_secret_for_app_e2e',
            JWT_ACCESS_SECRET: 'test_shared_secret_for_app_e2e',
            JWT_REFRESH_SECRET: 'test_refresh_secret_for_app_e2e',
            JWT_EXPIRATION: '15m',
            JWT_ACCESS_EXPIRATION: '15m',
            JWT_REFRESH_EXPIRATION: '7d',
            GOOGLE_CLIENT_ID: 'test_google_client_id_for_app_e2e',
            GOOGLE_CLIENT_SECRET: 'test_google_client_secret_for_app_e2e',
            GOOGLE_CALLBACK_URL: 'http://localhost:4001/auth/google/callback_for_app_e2e',
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
        // Include MongooseModule.forFeature if any imported modules below rely on it directly
        // For AppController/AppService, this might not be strictly necessary unless they inject models
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: Todo.name, schema: TodoSchema }
        ]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          // Playground might not be needed for this simple test but doesn't hurt
          playground: true,
          context: ({ req }) => ({ req }),
        }),
        // Import modules that AppController might depend on, or that provide global guards/interceptors
        AuthModule,
        UsersModule,
        TodosModule,
      ],
      controllers: [AppController], // Explicitly declare AppController
      providers: [AppService],     // Explicitly declare AppService
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply global pipes as in main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
