// src/users/users.service.ts
import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../common/enums/role.enum';
import * as bcrypt from 'bcrypt';
import { ResponseService } from 'src/common/services/response.service';
import {  OrderStatus } from '@prisma/client';



@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly response:ResponseService) { }
 
  async create(data: CreateUserDto) {
    const user =  await this.prisma.user.create({
       data: {
      ...data,
      role: data.role ?? 'CUSTOMER',
    },
    
      });
      return user;
      
  }

 async findAll() {
    const users =  await this.prisma.user.findMany({
        select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        phoneNumber: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return this.response.success('Users fetched successfully',users);
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        phoneNumber: true,
        address: true,
        createdAt: true,
        updatedAt: true,
      },
    });

  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

 async updateProfile(id: number, data: UpdateUserDto, currentUser: any) 
 {
  if (id !== currentUser.userId && currentUser.role !== Role.ADMIN) {
    throw new ForbiddenException('You can only update your own profile');
  }

  if (data.role && currentUser.role !== Role.ADMIN) {
    delete data.role;
  }

  return this.prisma.user.update({ where: { id }, data });
}



 async remove(id: number, currentUser: any, password: string) {
  if (currentUser.role !== Role.ADMIN && currentUser.userId !== id) {
    throw new ForbiddenException('You can only delete your own account');
  }

  if (currentUser.role !== Role.ADMIN) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }
  }
  return this.prisma.user.delete({ where: { id } });
}

async getUserOrders(userId: number,OrderStatus?:OrderStatus) 
{
  const whereClause: any = { customerId: userId };
  if (OrderStatus) {
    whereClause.status = OrderStatus;
  }
  return this.prisma.order.findMany({
    where: whereClause,
    include: {
      orderItems: {
        include: { product: true }
      }
    },
    
  });
}
}