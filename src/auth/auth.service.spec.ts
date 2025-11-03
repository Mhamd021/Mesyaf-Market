import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUsersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-jwt'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should register a user and return token', async () => {
  const dto = { email: 'test@test.com', password: 'secret', name: 'Test' };

  // Mock UsersService.create to return a fake user
  mockUsersService.create.mockResolvedValue({
    id: 1,
    email: dto.email,
    password: await bcrypt.hash(dto.password, 10),
    name: dto.name,
  });

  const result = await service.register(dto);

  expect(result).toEqual({ access_token: 'signed-jwt' });
  expect(mockUsersService.create).toHaveBeenCalled();
  expect(jwtService.sign).toHaveBeenCalled();
});
it('should login with valid credentials', async () => {
  const hashed = await bcrypt.hash('secret', 10);

  mockUsersService.findByEmail.mockResolvedValue({
    id: 1,
    email: 'test@test.com',
    password: hashed,
  });

  const result = await service.login({
    email: 'test@test.com',
    password: 'secret',
  });

  expect(result).toEqual({ access_token: 'signed-jwt' });
  expect(jwtService.sign).toHaveBeenCalled();
});
it('should throw if user not found', async () => {
  mockUsersService.findByEmail.mockResolvedValue(null);

  await expect(
    service.login({ email: 'wrong@test.com', password: 'secret' }),
  ).rejects.toThrow(UnauthorizedException);
});
it('should throw if password is invalid', async () => {
  const hashed = await bcrypt.hash('secret', 10);

  mockUsersService.findByEmail.mockResolvedValue({
    id: 1,
    email: 'test@test.com',
    password: hashed,
  });

  await expect(
    service.login({ email: 'test@test.com', password: 'wrong' }),
  ).rejects.toThrow(UnauthorizedException);
});

});
