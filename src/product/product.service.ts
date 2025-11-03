import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddProductImageDto } from './dto/add-product-image.dto';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) { }

  //validate ownership and get product
  private async validateOwnershipAndGetProduct(userId: number, productId: number) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true, isActive: true },
    });

    if (!vendor) throw new NotFoundException('Vendor profile not found');
    if (!vendor.isActive) throw new ForbiddenException('Vendor profile is inactive');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, vendorId: true },
    });

    if (!product) throw new NotFoundException('Product not found');
    if (product.vendorId !== vendor.id) throw new ForbiddenException('You do not own this product');

    return { vendorId: vendor.id, productId: product.id };
  }

  //fetch products for a vendor
  private async fetchProductsForVendor(vendorId: number) {
    return this.prisma.product.findMany({
      where: { vendorId },
      include: { category: true, images: true, tags: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  //create product
  async createProduct(userId: number, dto: CreateProductDto) {

    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true, isActive: true },
    });

    if (!vendor || !vendor.isActive) {
      throw new ForbiddenException('Vendor profile not found or inactive');
    }

    await this.prisma.product.create({
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
    });

    return { message: 'Product created successfully' };
  }

  
  // Update product: returns the updated product with relations
  async updateProduct(
    userId: number,
    productId: number,
    dto: Partial<UpdateProductDto>,
  ) {
    
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

    return updated;
  }


// Delete product
  async deleteProduct(userId: number, productId: number) {
    await this.validateOwnershipAndGetProduct(userId, productId);

    
    await this.prisma.$transaction([
      this.prisma.productImage.deleteMany({ where: { productId } }),
      this.prisma.product.delete({ where: { id: productId } }),
    ]);

    return { message: 'Product deleted successfully' };
  }

  //add product images, returns updated product with images
  async addProductImages(userId: number, productId: number, dto: AddProductImageDto) {
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

  return {
    message: 'Image added',
    image: img,
    imageCount: count,
  };
}



  //get products for a vendor by vendor id

  async getVendorProducts(vendorId: number) {
    return this.fetchProductsForVendor(vendorId);
  }

  //get products for a vendor by user id
  async getVendorProductsByUser(userId: number) {
    const vendor = await this.prisma.vendorProfile.findUnique({
      where: { userId },
      select: { id: true, isActive: true },
    });
    if (!vendor) throw new NotFoundException('Vendor profile not found');
    if (!vendor.isActive) throw new ForbiddenException('Vendor profile inactive');
    return this.fetchProductsForVendor(vendor.id);
  }



  // get product by id with relations

  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        category: true,
        tags: true,
        vendor: {
          select: {
            shopName: true,
            rating: true,
          },
        },
      },
    });

    if (!product || !product.isAvailable) {
      throw new NotFoundException('Product not found or unavailable');
    }

    return product;
  }




}