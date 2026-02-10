// src/users/users.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { ResponseService } from 'src/common/services/response.service';
import { OrderStatus } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly response: ResponseService
  ) {}

 

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll() {
    const users = await this.usersService.findAll();
    return this.response.success('Users fetched successfully', users);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
async getProfile(@Req() req) {
    const user = await this.usersService.findOne(req.user.userId);
    if (!user) {
      return this.response.error('User not found', 404);
    }
    return this.response.success('Profile fetched successfully', user);
  }


  @Patch('me')
@UseGuards(AuthGuard('jwt'))
async updateMyProfile(@Req() req, @Body() dto: UpdateUserDto) {
    const updated = await this.usersService.updateProfile(req.user.userId, dto, req.user);
    return this.response.success('Profile updated successfully', updated);
  }





  @Delete(':id')
@UseGuards(AuthGuard('jwt'))
async remove(
    @Param('id') id: string,
    @Req() req,
    @Body('password') password: string,
  ) {
    const deleted = await this.usersService.remove(+id, req.user, password);
    return this.response.success('User deleted successfully', deleted);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/orders')
  async getUserOrders(
  @Req() req,
  @Query('status') status?: OrderStatus,
) {
  return await this.usersService.getUserOrders(req.user.userId, status);
}


}
