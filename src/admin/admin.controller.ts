import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { Roles } from 'src/common/decorators/roles.decorator';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('allUsers')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('vendors/pending')
  async getPendingVendors() {
    return this.adminService.getPendingVendors();
  }

  @Patch('vendors/:vendorId/approve')
  async approveVendorPromotion(
    @Param('vendorId', ParseIntPipe) vendorId: number,
    @Body('approve') approve: boolean,
    @Body('reason') reason?: string
  ) {
    return this.adminService.approveVendorPromotion(vendorId, approve, reason);
  }

  @Patch('vendors/:vendorId/suspend')
  async suspendVendor(
    @Param('vendorId', ParseIntPipe) vendorId: number,
    @Body('reason') reason: string
  ) {
    return this.adminService.suspendVendor(vendorId, reason);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: Role,
    @Body('reason') reason?: string
  ) {
    return this.adminService.updateUserRole(id, role, reason);
  }


  @Post(':userId/promote')
  @Roles(Role.ADMIN)
  async promoteUserToDeliverer(@Param('userId', ParseIntPipe) userId: number) 
  {
    return this.adminService.promoteUserToDeliverer(userId);
  }

  @Delete(':userId')
  @Roles(Role.ADMIN)
  async removeDeliverer
  (@Param('userId', ParseIntPipe) userId: number) 
  {
    return this.adminService.removeDeliverer(userId);
  }
}
