import {Controller,Get,Patch,Body,Param,ParseIntPipe,UseGuards,Req, Query,} from '@nestjs/common';
import { DelivererService } from './deliverer.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { AuthGuard } from '@nestjs/passport';
import { UpdateDelivererProfileDto } from './dto/update_deliverer.dto';
import { JobStatus } from '@prisma/client';
import { DelivererJobService } from './deliverer-job.service';

@Controller('deliverer')
export class DelivererController {
  constructor(private readonly delivererService: DelivererService, private readonly delivererJobService: DelivererJobService) { }

    @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DELIVERER)
  @Get('me')
  async getMyProfile(@Req() req) {
    
    return this.delivererService.getProfileByUserId(req.user.id);
  }

  @Get(':userId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async getProfile(@Param('userId', ParseIntPipe) userId: number) {
    return this.delivererService.getProfileByUserId(userId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.DELIVERER)
  @Patch('me')
  async updateMyProfile(@Req() req, @Body() dto: UpdateDelivererProfileDto) {
    
    return this.delivererService.updateProfile(req.user.id, dto);
  }



 @Get('/jobs')
@UseGuards(AuthGuard('jwt'))
async getDelivererJobs(@Req() req, @Query('status') status?: JobStatus) 
{
  return this.delivererJobService.getDelivererJobs(req.user.id, status);
}

}