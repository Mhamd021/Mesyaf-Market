import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ResponseService } from 'src/common/services/response.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt to control hashing/compare behavior in tests
jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  // Typed mocked dependencies
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let responseService: jest.Mocked<ResponseService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { create: jest.fn(), findByEmail: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ResponseService, useValue: { success: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    responseService = module.get(ResponseService);

    jest.clearAllMocks();
  });

  it('register: hashes password, creates user, returns token via ResponseService', async () => {
  const dto = { email: 'test@test.com', password: 'secret', name: 'Test' };

  // Arrange: mock bcrypt.hash
  (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-secret');

  // Arrange: mock UsersService.create result
    usersService.create.mockResolvedValue({
      id: 1,
      email: dto.email,
      password: 'hashed-secret',
      role: 'CUSTOMER',
      name: dto.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

  // Arrange: mock JwtService.sign
  jwtService.sign.mockReturnValue('signed-jwt');

  // Arrange: decide the ResponseService.success shape (your service wraps token)
  // Example shape: { success: true, message: '...', data: { access_token: '...' } }
  const expected = {
    success: true,
    message: 'User registered successfully',
    data: { access_token: 'signed-jwt' },
  };
  responseService.success.mockReturnValue(expected);

  // Act
  const result = await service.register(dto);

  // Assert
  expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
  expect(usersService.create).toHaveBeenCalledWith({
    ...dto,
    password: 'hashed-secret',
  });
  expect(jwtService.sign).toHaveBeenCalledWith({ sub: 1, email: 'test@test.com', role: 'CUSTOMER' });
  expect(responseService.success).toHaveBeenCalledWith('User registered successfully', { access_token: 'signed-jwt' });
  expect(result).toEqual(expected);
});
it('login: throws if user not found', async () => {
  usersService.findByEmail.mockResolvedValue(null);

  await expect(service.login({ email: 'x@test.com', password: '123' }))
    .rejects
    .toThrow(UnauthorizedException);

  expect(usersService.findByEmail).toHaveBeenCalledWith('x@test.com');
});

it('login: throws if password invalid', async () => {
  usersService.findByEmail.mockResolvedValue({
    id: 1,
    name: 'Test',
    email: 'test@test.com',
    password: 'hashed-secret',
    role: 'CUSTOMER',
    profileImage: null,
    phoneNumber: null,
    address: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  (bcrypt.compare as jest.Mock).mockResolvedValue(false); // password mismatch

  await expect(service.login({ email: 'test@test.com', password: 'wrong' }))
    .rejects
    .toThrow(UnauthorizedException);

  expect(bcrypt.compare).toHaveBeenCalledWith('wrong', 'hashed-secret');
});

it('login: returns token via ResponseService on valid credentials', async () => {
  usersService.findByEmail.mockResolvedValue({
   id: 1,
    name: 'Test',
    email: 'test@test.com',
    password: 'hashed-secret',
    role: 'CUSTOMER',
    profileImage: null,
    phoneNumber: null,
    address: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  jwtService.sign.mockReturnValue('signed-jwt');

  const expected = {
    success: true,
    message: 'Login successful',
    data: { access_token: 'signed-jwt' },
  };
  responseService.success.mockReturnValue(expected);

  const result = await service.login({ email: 'test@test.com', password: 'secret' });

  expect(usersService.findByEmail).toHaveBeenCalledWith('test@test.com');
  expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed-secret');
  expect(jwtService.sign).toHaveBeenCalledWith({ sub: 1, email: 'test@test.com', role: 'CUSTOMER' });
  expect(responseService.success).toHaveBeenCalledWith('Login successful', { access_token: 'signed-jwt' });
  expect(result).toEqual(expected);
});

it('generateToken: signs payload correctly', () => {
  jwtService.sign.mockReturnValue('signed-jwt');
  
  const result = service['generateToken']({ id: 7, email: 'a@b.com', role: 'ADMIN' });
  expect(jwtService.sign).toHaveBeenCalledWith({ sub: 7, email: 'a@b.com', role: 'ADMIN' });
  expect(result).toEqual({ access_token: 'signed-jwt' });
});


});
