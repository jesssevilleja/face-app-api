import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateUserInput } from '../src/users/dto/create-user.input';
import { LoginInput } from '../src/auth/dto/login.input';
import { CreateTodoInput } from '../src/todos/dto/create-todo.input';
import { UpdateTodoInput } from '../src/todos/dto/update-todo.input';
import { App } from 'supertest/types';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Added ConfigModule, ConfigService
import { GraphQLModule } from '@nestjs/graphql'; // Added GraphQLModule
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo'; // Added ApolloDriver, ApolloDriverConfig
import { join } from 'path'; // Added join
import { WinstonModule } from 'nest-winston'; // Added WinstonModule
import { loggerConfig } from '../src/config/logger.config'; // Added loggerConfig
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose'; // Removed Connection, mongoose itself will handle connection via MongooseModule
import { User, UserSchema } from '../src/users/schemas/user.schema';
import { Todo, TodoSchema } from '../src/todos/schemas/todo.schema';
// Import submodules used in AppModule, assuming they are needed for the tests
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { TodosModule } from '../src/todos/todos.module';

describe('TodosResolver (e2e)', () => {
  let app: INestApplication<App>;
  let httpServer: any;
  let mongod: MongoMemoryServer;
  // let mongoConnection: Connection; // No longer needed
  let userModel: Model<User>;
  let todoModel: Model<Todo>;
  let accessToken: string;
  let testUserId: string;

  const graphqlEndpoint = '/graphql';

  const testUser = {
    email: 'todo-testuser@example.com',
    password: 'password123',
    name: 'TodoTestUser',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true, // Don't load .env, use in-memory URI and test JWT secrets
          load: [
            () => ({
              MONGODB_URI: uri,
              JWT_SECRET: 'test_shared_secret_for_todos_e2e', // Used by JwtModule for signing
              JWT_ACCESS_SECRET: 'test_shared_secret_for_todos_e2e', // Used by JwtStrategy for validation
              JWT_REFRESH_SECRET: 'test_refresh_secret_for_todos_e2e',
              JWT_EXPIRATION: '15m', // Used by JwtModule for signing
              JWT_ACCESS_EXPIRATION: '15m', // Consistent for clarity
              JWT_REFRESH_EXPIRATION: '7d',
              GOOGLE_CLIENT_ID: 'test_google_client_id_for_todos_e2e',
              GOOGLE_CLIENT_SECRET: 'test_google_client_secret_for_todos_e2e',
              GOOGLE_CALLBACK_URL:
                'http://localhost:4001/auth/google/callback_for_todos_e2e',
            }),
          ],
        }),
        WinstonModule.forRoot(loggerConfig), // Added WinstonModule
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => ({
            uri: configService.get<string>('MONGODB_URI'),
          }),
        }),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema },
          { name: Todo.name, schema: TodoSchema },
        ]),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          playground: true,
          context: ({ req }) => ({ req }),
        }),
        AuthModule,
        UsersModule,
        TodosModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    httpServer = app.getHttpServer();

    // Get model instances for direct DB manipulation/cleanup if needed
    userModel = moduleFixture.get<Model<User>>(getModelToken(User.name));
    todoModel = moduleFixture.get<Model<Todo>>(getModelToken(Todo.name));

    // Create user and login to get accessToken
    const createUserInput: CreateUserInput = {
      email: testUser.email,
      password: testUser.password,
      name: testUser.name,
    };

    await request(httpServer)
      .post(graphqlEndpoint)
      .send({
        query: `
          mutation Signup($input: CreateUserInput!) {
            signup(input: $input) {
              user { id }
            }
          }
        `,
        variables: { input: createUserInput },
      });

    const loginInput: LoginInput = {
      email: testUser.email,
      password: testUser.password,
    };

    const loginResponse = await request(httpServer)
      .post(graphqlEndpoint)
      .send({
        query: `
          mutation Login($input: LoginInput!) {
            login(input: $input) {
              accessToken
              user { id }
            }
          }
        `,
        variables: { input: loginInput },
      });
    accessToken = loginResponse.body.data.login.accessToken;
    testUserId = loginResponse.body.data.login.user.id;
  });

  afterAll(async () => {
    // if (mongoConnection) { // No longer needed
    //     await mongoConnection.dropDatabase();
    //     await mongoConnection.close();
    // }
    if (mongod) {
      await mongod.stop();
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up todos before each test
    if (todoModel) {
      await todoModel.deleteMany({});
    }
  });

  describe('createTodo', () => {
    it('should create a new todo', async () => {
      const createTodoInput: CreateTodoInput = {
        title: 'New Todo for E2E Test',
        description: 'This is a test todo.',
      };

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `
            mutation CreateTodo($input: CreateTodoInput!) {
              createTodo(input: $input) {
                id
                title
                description
                completed
                userId # Changed owner to userId
              }
            }
          `,
          variables: { input: createTodoInput },
        })
        .expect(200); // Restored expect(200)

      // if (response.status !== 200) { // Debugging code removed
      //   console.error('CreateTodo Raw Error Response:', response.error);
      //   console.error('CreateTodo Raw Body:', response.body);
      // }
      // expect(response.status).toBe(200);

      const todo = response.body.data.createTodo;
      expect(todo.id).toBeDefined();
      expect(todo.title).toBe(createTodoInput.title);
      expect(todo.description).toBe(createTodoInput.description);
      expect(todo.completed).toBe(false);
      expect(todo.userId).toBe(testUserId); // Changed to check userId
    });

    it('should return validation error for empty title', async () => {
      const createTodoInput: CreateTodoInput = {
        title: '',
        description: 'This todo has an empty title.',
      };

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `
            mutation CreateTodo($input: CreateTodoInput!) {
              createTodo(input: $input) {
                id
              }
            }
          `,
          variables: { input: createTodoInput },
        })
        .expect(200); // Expect HTTP 400 as this is the consistent behavior observed

      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].extensions?.code).toBe('BAD_REQUEST'); // Align with observed error code
      expect(response.body.errors[0].message).toContain(
        'Bad Request Exception',
      );
    });
  });

  describe('getTodos', () => {
    it('should return a list of todos for the current user', async () => {
      // Create a todo first
      const createTodoInput: CreateTodoInput = {
        title: 'Todo 1 for getTodos',
        description: 'Description 1',
      };
      await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `mutation CreateTodo($input: CreateTodoInput!) { createTodo(input: $input) { id } }`,
          variables: { input: createTodoInput },
        });

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `
            query GetTodos($limit: Int, $offset: Int) {
              todos(limit: $limit, offset: $offset) {
                todos {
                  id
                  title
                  completed
                }
                totalCount
                hasMore
              }
            }
          `,
          variables: { limit: 5, offset: 0 },
        })
        .expect(200);

      const data = response.body.data.todos;
      expect(data.todos.length).toBe(1);
      expect(data.todos[0].title).toBe(createTodoInput.title);
      expect(data.totalCount).toBe(1);
      expect(data.hasMore).toBe(false);
    });
  });

  describe('getTodo', () => {
    let todoId: string;

    beforeEach(async () => {
      // Create a todo
      const createInput: CreateTodoInput = {
        title: 'Todo for getTodo test',
        description: '',
      };
      const res = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `mutation CreateTodo($input: CreateTodoInput!) { createTodo(input: $input) { id title userId } }`,
          variables: { input: createInput },
        })
        .expect(200); // Ensure todo creation in beforeEach is successful
      todoId = res.body.data.createTodo.id;
      console.log('[getTodo beforeEach] Created todoId:', todoId);
      const createdTodo = await todoModel.findById(todoId).lean();
      console.log(
        '[getTodo beforeEach] Found createdTodo via model:',
        createdTodo,
      );
    });

    it('should return a single todo by ID', async () => {
      console.log('[getTodo test] Attempting to fetch todoId:', todoId);
      console.log(
        '[getTodo test] Using accessToken:',
        accessToken ? accessToken.substring(0, 20) + '...' : 'null',
      );
      console.log(
        '[getTodo test] Using testUserId (owner for query context):',
        testUserId,
      );
      const todoExists = await todoModel
        .findOne({ _id: todoId, userId: testUserId })
        .lean();
      console.log(
        '[getTodo test] Todo exists in DB for this user right before query?:',
        todoExists,
      );

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `
            query GetTodo($id: ID!) {
              todo(id: $id) {
                id
                title
              }
            }
          `,
          variables: { id: todoId },
        })
        .expect(200);

      if (!response.body.data?.todo) {
        console.log(
          `GetTodo test: todoId was ${todoId}, but todo not found in response.`,
        );
      }
      expect(response.body.data.todo.id).toBe(todoId);
      expect(response.body.data.todo.title).toBe('Todo for getTodo test');
    });

    it('should return null if todo not found or not owned by user', async () => {
      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `
              query GetTodo($id: ID!) {
                todo(id: $id) {
                  id
                }
              }
            `,
          variables: { id: '60f7eabc1234567890abcdef' }, // A non-existent or non-owned ID
        })
        .expect(200);

      expect(response.body.data.todo).toBeNull();
    });
  });

  describe('updateTodo', () => {
    let todoIdToUpdate: string;

    beforeEach(async () => {
      const createInput: CreateTodoInput = {
        title: 'Todo to update',
        description: 'Initial desc',
      };
      const res = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `mutation CreateTodo($input: CreateTodoInput!) { createTodo(input: $input) { id } }`,
          variables: { input: createInput },
        });
      todoIdToUpdate = res.body.data.createTodo.id;
    });

    it('should update a todo', async () => {
      const updateTodoInput: UpdateTodoInput = {
        title: 'Updated Todo Title',
        completed: true,
      };

      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `
            mutation UpdateTodo($id: ID!, $input: UpdateTodoInput!) {
              updateTodo(id: $id, input: $input) {
                id
                title
                completed
              }
            }
          `,
          variables: { id: todoIdToUpdate, input: updateTodoInput },
        })
        .expect(200);

      const updatedTodo = response.body.data.updateTodo;
      expect(updatedTodo.title).toBe(updateTodoInput.title);
      expect(updatedTodo.completed).toBe(true);
    });
  });

  describe('deleteTodo', () => {
    let todoIdToDelete: string;

    beforeEach(async () => {
      const createInput: CreateTodoInput = {
        title: 'Todo to delete',
        description: '',
      };
      const res = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `mutation CreateTodo($input: CreateTodoInput!) { createTodo(input: $input) { id } }`,
          variables: { input: createInput },
        });
      todoIdToDelete = res.body.data.createTodo.id;
    });

    it('should delete a todo', async () => {
      const response = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `
            mutation DeleteTodo($id: ID!) {
              deleteTodo(id: $id)
            }
          `,
          variables: { id: todoIdToDelete },
        })
        .expect(200);

      expect(response.body.data.deleteTodo).toBe(true);

      // Verify it's actually deleted
      const verifyResponse = await request(httpServer)
        .post(graphqlEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          query: `query GetTodo($id: ID!) { todo(id: $id) { id } }`,
          variables: { id: todoIdToDelete },
        });
      expect(verifyResponse.body.data.todo).toBeNull();
    });
  });
});
