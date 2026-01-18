import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVendorProfileDto } from './dto/create-vendor-profile.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { ResponseService } from 'src/common/services/response.service';
import { OrderStatus } from '@prisma/client';


@Injectable()
export class VendorService 
{
    constructor
    (
      private prisma: PrismaService,
      private response: ResponseService
    ) 
  {}
    
    async createProfile(userId: number, dto: CreateVendorProfileDto) 
    {
      
  
  const existing = await this.prisma.vendorProfile.findUnique({ where: { userId: userId } });
  if (existing) {
    throw new ConflictException('Vendor profile already exists');
  }

  const profile = await this.prisma.vendorProfile.create({
    data: {
      userId,
      shopName: dto.shopName,
      coverImage: dto.coverImage,
      description: dto.description,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      isVerified: false,
      isActive: true,
    },
  });

  return this.response.created('Vendor profile created successfully', profile);
}


async getProfileByUserId(userId: number) 
{
  const profile = await this.prisma.vendorProfile.findFirst({
    where: {
      userId,
      isActive: true,
      isVerified: true,
    },
  });

  if (!profile) {
  throw new NotFoundException('Vendor profile not found');
}
  return this.response.success('Vendor profile retrieved successfully', profile);
}



async updateProfile(userId: number, dto: UpdateVendorProfileDto) {
  const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw new NotFoundException('Vendor profile not found');
  }

  const updated = await this.prisma.vendorProfile.update({
  where: { userId },
  data: { ...dto },
});
return this.response.success('Vendor profile updated successfully', updated);

}



async deleteProfile(userId: number, currentUserRole: Role) {
  const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundException('Vendor profile not found');

  if (profile.userId !== userId && currentUserRole !== Role.ADMIN) {
    throw new ForbiddenException('You are not allowed to delete this profile');
  }

  await this.prisma.$transaction(async (tx) => {
  
    const products = await tx.product.findMany({ where: { vendorId: profile.id } });
    for (const product of products) {
      
      await tx.product.update({
        where: { id: product.id },
        data: { tags: { set: [] } },
      });
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.product.delete({ where: { id: product.id } });
    }
    await tx.vendorProfile.delete({ where: { userId } });
  });

  return this.response.success('Vendor profile and all related products deleted successfully');
}

async toggleProfile(userId: number, isActive: boolean, currentUserRole: Role) {
  const profile = await this.prisma.vendorProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundException('Vendor profile not found');

  if (profile.userId !== userId && currentUserRole !== Role.ADMIN) {
    throw new ForbiddenException('You are not allowed to toggle this profile');
  }

  const updated = await this.prisma.vendorProfile.update({
    where: { userId },
    data: {
      isActive,
      suspendedAt: isActive ? profile.suspendedAt : new Date(),
      reactivatedAt: isActive ? new Date() : profile.reactivatedAt,
    },
  });

  return this.response.success(
    `Vendor profile ${isActive ? 'activated' : 'deactivated'} successfully`,
    updated
  );
}




async getProfileByVendorId(vendorId: number) {
  const profile = await this.prisma.vendorProfile.findFirst({
  where: { id: vendorId, isActive: true, isVerified: true },
});
if (!profile) {
  throw new NotFoundException('Vendor profile not found');
}
return this.response.success('Vendor profile retrieved successfully', profile);

}

async getAllVendors() {
  const vendors = await this.prisma.vendorProfile.findMany({
    where: { isActive: true, isVerified: true },
  });
  return this.response.success('All active vendors retrieved successfully', vendors);
}



async requestPromotionOrReactivation(userId: number, currentUserRole: Role) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { vendorProfile: true },
  });
  if (!user) throw new NotFoundException('User not found');

  // Case 1: Customer requesting promotion
  if (user.role === Role.CUSTOMER) {
    if (!user.vendorProfile) {
      throw new NotFoundException('No vendor profile exists for this user');
    }
    return this.prisma.vendorProfile.update({
      where: { userId },
      data: {
        demotionReason: null,
        isVerified: false, // pending admin approval
        isActive: true,
      },
    });
  }

  // Case 2: Vendor reactivating inactive store
  if (user.role === Role.VENDOR && user.vendorProfile?.isActive === false) {
    return this.prisma.vendorProfile.update({
      where: { userId },
      data: {
        isActive: true,
        reactivatedAt: new Date(),
        demotionReason: null,
      },
    });
  }

  throw new ForbiddenException('Invalid promotion/reactivation request');
}


async getVendorOrders(userId: number, orderStatus?: OrderStatus) {
  const vendorProfile = await this.prisma.vendorProfile.findUnique({
    where: { userId },
  });

  if (!vendorProfile) {
    throw new NotFoundException('Vendor profile not found');
  }

  const whereClause: any = {
    vendorId: vendorProfile.id,
    ...(orderStatus ? { status: orderStatus } : {}),
  };

  return this.prisma.order.findMany({
    where: whereClause,
    include: {
      orderItems: {
        include: { product: true },
      },
      customer: true,
    },
  });
}


}
