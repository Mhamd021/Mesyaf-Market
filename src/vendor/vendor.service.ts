import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVendorProfileDto } from './dto/create-vendor-profile.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';

@Injectable()
export class VendorService 
{
    constructor(private prisma: PrismaService) { }
    
    async createProfile(userId: number, dto: CreateVendorProfileDto) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== Role.VENDOR) {
    throw new ForbiddenException('Only vendors can create a profile');
  }

  const existing = await this.prisma.vendorProfile.findUnique({ where: { userId } });
  if (existing) {
    throw new ConflictException('Vendor profile already exists');
  }

  return this.prisma.vendorProfile.create({
    data: {
      userId,
      shopName: dto.shopName,
      coverImage: dto.coverImage,
      description: dto.description,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      
    },
  });
}

async getProfileByUserId(userId: number) {
  return this.prisma.vendorProfile.findFirst({
    where: {
      userId,
      isActive: true,
      isVerified: true,
    },
  });
}


async updateProfile(userId: number, dto: UpdateVendorProfileDto) {
  const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new NotFoundException('Vendor profile not found');
  }

  return this.prisma.vendorProfile.update({
    where: { userId },
    data: {
      ...dto,
    },
  });
}

async verifyProfile(userId: number, status: boolean, currentUserRole: Role) {
  if (currentUserRole !== Role.ADMIN) {
    throw new ForbiddenException('Only admins can verify vendor profiles');
  }

  return this.prisma.vendorProfile.update({
    where: { userId },
    data: { isVerified: status },
  });
}


async deleteProfile(userId: number, currentUserRole: Role) {
  const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new NotFoundException('Vendor profile not found');
  }

  if (profile.userId !== userId && currentUserRole !== Role.ADMIN) {
    throw new ForbiddenException('You are not allowed to delete this profile');
  }

  return this.prisma.vendorProfile.update({
    where: { userId },
    data: { isActive: false },
  });
}

async getProfileByVendorId(vendorId: number) {
  return this.prisma.vendorProfile.findFirst({
    where: {
      id: vendorId,
      isActive: true,
      isVerified: true,
    },
  });
}


}
