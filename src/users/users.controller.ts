// src/users/users.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

 

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
@UseGuards(AuthGuard('jwt'))
getProfile(@Req() req) {
  return this.usersService.findOne(req.user.userId);
}


  @Patch('me')
@UseGuards(AuthGuard('jwt'))
updateMyProfile(@Req() req, @Body() dto: UpdateUserDto) {
  return this.usersService.updateProfile(req.user.userId, dto, req.user);
}


@Patch(':id/role')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
updateRole(@Param('id') id: string, @Body('role') role: Role) {
  return this.usersService.updateRole(+id, role);
}


  @Delete(':id')
@UseGuards(AuthGuard('jwt'))
async remove(
  @Param('id') id: string,
  @Req() req,
  @Body('password') password: string,
) {
  return this.usersService.remove(+id, req.user, password);
}


}
