import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import * as bcrypt from 'bcrypt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------
  // CREATE
  // -----------------------------
  it('should create a user with hashed password', async () => {
    const dto = { email: 'test@test.com', password: 'secret', name: 'Test' };

    // simulate Prisma returning a user
    mockPrisma.user.create.mockImplementation(({ data }) => ({
      id: 1,
      email: data.email,
      password: data.password, // hashed
      name: data.name,
      role: Role.CUSTOMER,
    }));

    const result = await service.create({
      ...dto,
      password: await bcrypt.hash(dto.password, 10),
    });

    expect(result).toHaveProperty('id', 1);
    expect(result.password).not.toBe('secret'); // should be hashed
    expect(prisma.user.create).toHaveBeenCalled();
  });

  // -----------------------------
  // FIND BY EMAIL
  // -----------------------------
  it('should find user by email', async () => {
    const user = { id: 1, email: 'test@test.com', password: 'hashed' };
    mockPrisma.user.findUnique.mockResolvedValue(user);

    const result = await service.findByEmail('test@test.com');
    expect(result).toEqual(user);
  });

  // -----------------------------
  // UPDATE PROFILE
  // -----------------------------
  it('should update profile for the owner', async () => {
    const dto = { name: 'New Name' };
    const currentUser = { userId: 1, role: Role.CUSTOMER };
    mockPrisma.user.update.mockResolvedValue({ id: 1, ...dto });

    const result = await service.updateProfile(1, dto, currentUser);
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should throw if user tries to update another profile', async () => {
    const dto = { name: 'Hack' };
    const currentUser = { userId: 2, role: Role.CUSTOMER };

    await expect(service.updateProfile(1, dto, currentUser)).rejects.toThrow(
      ForbiddenException,
    );
  });

  // -----------------------------
  // REMOVE (DELETE)
  // -----------------------------
  it('should delete own account with valid password', async () => {
    const hashed = await bcrypt.hash('secret', 10);
    const user = { id: 1, password: hashed };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    mockPrisma.user.delete.mockResolvedValue(user);

    const currentUser = { userId: 1, role: Role.CUSTOMER };
    const result = await service.remove(1, currentUser, 'secret');

    expect(result).toEqual(user);
  });

  it('should throw if password is invalid', async () => {
    const hashed = await bcrypt.hash('secret', 10);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, password: hashed });

    const currentUser = { userId: 1, role: Role.CUSTOMER };

    await expect(service.remove(1, currentUser, 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow admin to delete without password', async () => {
    const user = { id: 2, password: 'hashed' };
    mockPrisma.user.delete.mockResolvedValue(user);

    const currentUser = { userId: 99, role: Role.ADMIN };
    const result = await service.remove(2, currentUser, '');
    
    expect(result).toEqual(user);
  });
});
