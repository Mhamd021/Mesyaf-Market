import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { AuthGuard } from '@nestjs/passport';
import { CreateVendorProfileDto } from './dto/create-vendor-profile.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';

@Controller('vendor')
export class VendorController 
{
    constructor(private readonly vendorService: VendorService) {}

    @Post('profile')
    @UseGuards( AuthGuard('jwt'), RolesGuard)
    @Roles(Role.CUSTOMER, Role.VENDOR)
    async createVendorProfile
    (
        @Req() req,
        @Body() dto: CreateVendorProfileDto
    )
    {
        return this.vendorService.createProfile(req.user.id, dto)
    }

    @Patch('profile/:vendorId/verify')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
async verifyVendor(
  @Param('vendorId', ParseIntPipe) vendorId: number,
  @Body('status') status: boolean,
  @Req() req
) {
  return this.vendorService.verifyVendorById(vendorId, status, req.user.role);
}


    @Get('profile/me')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)

    async getMyVendorProfile(@Req() req) 
    {
        return this.vendorService.getProfileByUserId(req.user.id);
    }

  
@Patch('profile')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.VENDOR)
async updateProfile(@Req() req, @Body() dto: UpdateVendorProfileDto) {
  return this.vendorService.updateProfile(req.user.id, dto);
}


   
  @Delete('profile')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.VENDOR, Role.ADMIN) 
async deleteProfile(@Req() req) {
  return this.vendorService.deleteProfile(req.user.id, req.user.role);
}


@Patch('profile/toggle')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.VENDOR, Role.ADMIN)
async toggleProfile(@Req() req, @Body('isActive') isActive: boolean) {
  return this.vendorService.toggleProfile(req.user.id, isActive, req.user.role);
}




@Get(':vendorId')
async getProfileByVendorId(
  @Param('vendorId', ParseIntPipe) vendorId: number,
) {
  return this.vendorService.getProfileByVendorId(vendorId);
}

@Get('all')
async getAllVendors() {
  return this.vendorService.getAllVendors();
}



@Patch('profile/:userId/request')
@UseGuards(AuthGuard('jwt'))
async requestPromotionOrReactivation(
  @Param('userId', ParseIntPipe) userId: number,
  @Req() req
) {
  return this.vendorService.requestPromotionOrReactivation(userId, req.user.role);
}


}
