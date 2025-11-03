// src/users/users.service.ts
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../common/enums/role.enum';
import * as bcrypt from 'bcrypt';


@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  create(data: CreateUserDto) {
    return this.prisma.user.create({ data });
  }

  findAll() {
    return this.prisma.user.findMany({
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

 async updateProfile(id: number, data: UpdateUserDto, currentUser: any) {
  // Ensure user can only update their own profile
  if (id !== currentUser.userId && currentUser.role !== Role.ADMIN) {
    throw new ForbiddenException('You can only update your own profile');
  }

  // Extra: strip out role unless admin
  if (data.role && currentUser.role !== Role.ADMIN) {
    delete data.role;
  }

  return this.prisma.user.update({ where: { id }, data });
}



  updateRole(id: number, role: Role) {
    return this.prisma.user.update({ where: { id }, data: { role } });
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
}