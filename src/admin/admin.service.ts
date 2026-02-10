import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums/role.enum';
import { ResponseService } from '../common/services/response.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly response: ResponseService,private readonly usersService: UsersService,) {}


  async getAllUsers() {
    return this.usersService.findAll();
  }

  async updateUserRole(id: number, role: Role, reason?: string) {
  const user = await this.prisma.user.findUnique({ where: { id }, include: { vendorProfile: true } });
  if (!user) throw new NotFoundException('User not found');

  if (user.role === Role.VENDOR && role === Role.CUSTOMER && user.vendorProfile) {
    await this.prisma.vendorProfile.update({
      where: { userId: id },
      data: {
        isActive: false,
        isVerified: false,
        demotionReason: reason ?? 'demoted',
        suspendedAt: new Date(),
      },
    });
  }

  const updatedUser = await this.prisma.user.update({ where: { id }, data: { role } });
  return this.response.success('User role updated successfully', updatedUser);
}

async approveVendorPromotion(vendorId: number, approve: boolean, reason?: string) {
  const profile = await this.prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    include: { user: true },
  });
  if (!profile) throw new NotFoundException('Vendor profile not found');

  if (approve) {
    const updatedProfile = await this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: { isVerified: true, isActive: true, reactivatedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id: profile.userId }, data: { role: Role.VENDOR } });
    return this.response.success('Vendor promotion approved successfully', updatedProfile);
  } else {
    const updatedProfile = await this.prisma.vendorProfile.update({
      where: { id: vendorId },
      data: { isVerified: false, isActive: false, demotionReason: reason ?? 'rejected', suspendedAt: new Date() },
    });
    return this.response.success('Vendor promotion rejected', updatedProfile);
  }
}

async suspendVendor(vendorId: number, reason: string) {
  const profile = await this.prisma.vendorProfile.findUnique({ where: { id: vendorId } });
  if (!profile) throw new NotFoundException('Vendor profile not found');

  const updatedProfile = await this.prisma.vendorProfile.update({
    where: { id: vendorId },
    data: { isActive: false, isVerified: false, demotionReason: reason, suspendedAt: new Date() },
  });

  return this.response.success('Vendor suspended successfully', updatedProfile);
}

async getPendingVendors() {
  const pending = await this.prisma.vendorProfile.findMany({
    where: { isVerified: false, isActive: true },
  });
  return this.response.success('Pending vendor applications retrieved successfully', pending);
}

//deliverer management functions 
async promoteUserToDeliverer(userId: number) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException('User not found');

  // Update role
  await this.prisma.user.update({
    where: { id: userId },
    data: { role: Role.DELIVERER },
  });

  // Create profile with fixed defaults
  const profile = await this.prisma.delivererProfile.create({
    data: {
      userId,
      maxConcurrentOrders: 3,
      maxStops: 5,
      acceptsBatching: true,
    },
  });

  return this.response.success('User promoted to Deliverer and profile created', profile);
}

async removeDeliverer(userId: number) {
  const profile = await this.prisma.delivererProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundException('Deliverer profile not found');

  // Delete profile
  await this.prisma.delivererProfile.delete({ where: { userId } });

  // Demote user back to CUSTOMER
  await this.prisma.user.update({
    where: { id: userId },
    data: { role: Role.CUSTOMER },
  });

  return this.response.success('Deliverer removed and user demoted to Customer');
}

}
