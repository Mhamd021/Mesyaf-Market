import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddProductImageDto } from './dto/add-product-image.dto';
import { ProductFilterDto } from './dto/ProductFilter.dto';
import { ResponseService } from 'src/common/services/response.service';


@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService , private readonly response: ResponseService) { }

  //validate ownership and get product
  private async validateOwnershipAndGetProduct(userId: number, productId: number) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true, isActive: true, isVerified: true },
    });

    if (!vendor) throw new NotFoundException('Vendor profile not found');
    if (!vendor.isActive || !vendor.isVerified) {
      throw new ForbiddenException('Vendor profile is inactive or not verified');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, vendorId: true },
    });

    if (!product) throw new NotFoundException('Product not found');
    if (product.vendorId !== vendor.id) throw new ForbiddenException('You do not own this product');
    
    return { vendorId: vendor.id, productId: product.id };
  }

  //fetch products for a vendor
  private async fetchProductsForVendor(vendorId: number, filter: ProductFilterDto) {
  // Check vendor profile status
  const vendor = await this.prisma.vendorProfile.findUnique({
    where: { id: vendorId },
    select: { isActive: true, isVerified: true },
  });
  if (!vendor) throw new NotFoundException('Vendor profile not found');
  if (!vendor.isActive || !vendor.isVerified) {
    throw new ForbiddenException('Vendor profile is inactive or not verified');
  }

  const { categoryId, tagIds, search, page = 1, limit = 10 } = filter;

  const where: any = {
    vendorId,
    isAvailable: true,
    ...(categoryId && { categoryId }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
    ...(tagIds?.length && { tags: { some: { id: { in: tagIds } } } }),
  };

  const [products, total] = await this.prisma.$transaction([
    this.prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: true, images: true, tags: true },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.product.count({ where }),
  ]);

  return this.response.success('Vendor products fetched successfully', {
    data: products,
    count: total,
    page,
    limit,
  });
}


  //create product
  async createProduct(userId: number, dto: CreateProductDto) {

    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true, isActive: true, isVerified: true },
    });

    if (!vendor || !vendor.isActive || !vendor.isVerified) {
      throw new ForbiddenException('Vendor profile not found, inactive, or not verified');
    }

    const product = await this.prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        discountPrice: dto.discountPrice,
        stockQuantity: dto.stockQuantity ?? 0,
        condition: dto.condition,
        isAvailable: dto.isAvailable,
      },
      include: { category: true, tags: true, images: true },
    });

    return this.response.created('Product created successfully', product);
  }


  // Update product: returns the updated product with relations
  async updateProduct(userId: number, productId: number, dto: Partial<UpdateProductDto>) {
  await this.validateOwnershipAndGetProduct(userId, productId);

  const updated = await this.prisma.product.update({
    where: { id: productId },
    data: { ...dto },
    include: {
      images: true,
      tags: true,
      category: true,
    },
  });

  return this.response.success('Product updated successfully', updated);
}



  // Delete product
  async deleteProduct(userId: number, productId: number) 
  {
    await this.validateOwnershipAndGetProduct(userId, productId);

    await this.prisma.$transaction(async (tx) => {
    
    await tx.product.update({
      where: { id: productId },
      data: { tags: { set: [] } },
    });
    await tx.productImage.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
  });

    return this.response.success('Product deleted successfully');
  }


  // get product by id with relations

  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        category: true,
        tags: true,
        vendor: { select: { shopName: true, rating: true, isActive: true, isVerified: true } },
      },
    });

    if (!product || !product.isAvailable  || !product.vendor.isActive || !product.vendor.isVerified) {
      throw new NotFoundException('Product not found or unavailable');
    }

    return this.response.success('Product fetched successfully', product);
  }

  //get all products with filters
  async getAllProducts(filter: ProductFilterDto) {
  const { categoryId, tagIds, search, page = 1, limit = 10 } = filter;

  const where: any = {
    isAvailable : true,
    vendor: { isActive: true, isVerified: true },
    ...(categoryId && { categoryId }),
    ...(search && { name: { contains: search, mode: 'insensitive' } }),
    ...(tagIds?.length && {
      tags: { some: { id: { in: tagIds } } },
    }),
  };

  const [products, total] = await this.prisma.$transaction([
    this.prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { tags: true, images: true },
    }),
    this.prisma.product.count({ where }),
  ]);

  return this.response.success('Products fetched successfully', {
    data: products,
    count: total,
    page,
    limit,
  });
}


  //get products for a vendor by vendor id

  async getVendorProducts(vendorId: number, filter: ProductFilterDto) {
  return this.fetchProductsForVendor(vendorId, filter);
}


  //get products for a vendor by user id
  async getVendorProductsByUser(userId: number, filter: ProductFilterDto) {
  const vendor = await this.prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true, isActive: true, isVerified: true },
  });
  if (!vendor) throw new NotFoundException('Vendor profile not found');
 if (!vendor.isActive || !vendor.isVerified) {
  throw new ForbiddenException('Vendor profile inactive or not verified');
}

  return this.fetchProductsForVendor(vendor.id, filter);
}


  //add product images, returns updated product with images
  async addProductImage(userId: number, productId: number, dto: AddProductImageDto) 
  {
    await this.validateOwnershipAndGetProduct(userId, productId);

    const [img, count] = await this.prisma.$transaction([
      this.prisma.productImage.create({
        data: {
          productId,
          url: dto.url,
          altText: dto.altText ?? null,
        },
        select: {
          id: true,
          url: true,
          altText: true,
          productId: true,

        },
      }),
      this.prisma.productImage.count({ where: { productId } }),
    ]);

    return this.response.success('Image added successfully', {
    image: img,
    imageCount: count,
  });
  }
  //remove product image
  async removeProductImage(userId: number, productId: number, imageId: number) {
    await this.validateOwnershipAndGetProduct(userId, productId);

    const deleted = await this.prisma.productImage.deleteMany({
      where: {
        id: imageId,
        productId,

      },
    });

    return this.response.success('Image removed successfully', {
      removed: deleted.count,
    });
  }

  async clearProductImages(userId: number, productId: number) 
  {
    await this.validateOwnershipAndGetProduct(userId, productId);
    const result = await this.prisma.productImage.deleteMany({
      where: { productId },
    });
    return this.response.success('All images removed successfully', {
      removedCount: result.count,
    });
    
  }

  //add and remove tags
  async attachTags(userId: number, productId: number, tagIds: number[]) {
    await this.validateOwnershipAndGetProduct(userId, productId);

    if (!tagIds || tagIds.length === 0) {
      throw new BadRequestException('No tag IDs provided');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: {
        tags: {
          connect: tagIds.map(id => ({ id })),
        },
      },
      select: {
        id: true,
        name: true,
        tags: { select: { id: true, name: true } },
      },
    });

    return this.response.success('Tags added successfully', {
      product: updated,
    });
  }

  async detachTags(userId: number, productId: number, tagIds: number[]) {
    await this.validateOwnershipAndGetProduct(userId, productId);
    if (!tagIds || tagIds.length === 0) {
      throw new BadRequestException('No tag IDs provided');
    }
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data:
      {
        tags:
        {
          disconnect: tagIds.map(id => ({ id })),

        },
      },
      select:
      {
        id: true,
        name: true,
        tags: { select: { id: true, name: true } }
      }
    });
    return this.response.success('Tags removed successfully', {
      product: updated,
    });

  }

  async removeAllTags(userId: number, productId: number) {
    await this.validateOwnershipAndGetProduct(userId, productId);
    const updated = await this.prisma.product.update({
      where: { id: productId },
      data:
      {
        tags:
        {
          set: []
        }
      }
    });
    return this.response.success('All tags removed successfully', {
      product: updated,
    });
  }
}