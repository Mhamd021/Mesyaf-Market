import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateDelivererProfileDto } from './dto/update_deliverer.dto';
import { ResponseService } from '../common/services/response.service';
import { JobStatus, OrderStatus } from '@prisma/client';

@Injectable()
export class DelivererService {
  constructor(private readonly prisma: PrismaService,private response: ResponseService) {}

  async getProfileByUserId(userId: number) 
  {
    const profile = await this.prisma.delivererProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!profile) throw new NotFoundException('Deliverer profile not found');
    return this.response.success("Deliverer profile retrieved successfully",profile);
  }

  async updateProfile(userId: number, dto: UpdateDelivererProfileDto) 
  {
    const profile = await this.prisma.delivererProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Deliverer profile not found');

    return this.prisma.delivererProfile.update({
      where: { userId },
      data: {
        currentLat: dto.currentLat ?? profile.currentLat,
        currentLng: dto.currentLng ?? profile.currentLng,
        availability: dto.availability ?? profile.availability,
      },
    });
  }

  
  async listAvailableDeliverers() {
    const deliverers =  this.prisma.delivererProfile.findMany({
      where: { availability: true },
      include: { user: true },
    });
    
    return this.response.success('Available deliverers retrieved successfully',deliverers)

  }


  


 

}
