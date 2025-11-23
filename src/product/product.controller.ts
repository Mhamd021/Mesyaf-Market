import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ProductService } from './product.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AddProductImageDto } from './dto/add-product-image.dto';
import { AttachTagsDto } from './dto/assign-tags.dto';
import { RemoveTagsDto } from './dto/remove-tags.dto';
import { ProductFilterDto } from './dto/ProductFilter.dto';

@Controller('product')
export class ProductController {

    constructor(private readonly productService: ProductService) { }

    @Post('products')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)

    async createProduct(@Req() req, @Body() dto: CreateProductDto) {
        return this.productService.createProduct(req.user.id, dto);
    }

    @Patch('products/:id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async updateProduct(
        @Req() req,
        @Body() dto: UpdateProductDto,
        @Param('id', ParseIntPipe) productId: number,
    ) {
        return this.productService.updateProduct(req.user.id, productId, dto);

    }

    @Delete('products/:id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async deleteProduct(
        @Req() req,
        @Param('id', ParseIntPipe) productId: number,
    ) {
        return this.productService.deleteProduct(req.user.id, productId);
    }

    @Get('products/:id')
    @UseGuards(AuthGuard('jwt'))

    async getProduct
        (
            @Param('id', ParseIntPipe) productId: number,
        ) {
        return this.productService.getProductById(productId);
    }

    @Get('products/me')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async getMyProducts
    (
       @Req() req,
     @Query() filter: ProductFilterDto

) {
        return this.productService.getVendorProductsByUser(req.user.id,filter);
    }

    @Get('products/vendor/:vendorId')
    @UseGuards(AuthGuard('jwt'))
    async getVendorProducts
        (
            @Param('vendorId', ParseIntPipe) vendorId: number,
            @Query() filter: ProductFilterDto
        ) {
        return this.productService.getVendorProducts(vendorId,filter);
    }

    //get all products
    @Get('products')
        async getAllProducts(@Query() filter: ProductFilterDto) {
         return this.productService.getAllProducts(filter);
}

    

    //product image

    @Post('products/:id/images')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async addProductImage
        (
            @Req() req,
            @Param('id', ParseIntPipe) productId: number,
            @Body() dto: AddProductImageDto
        ) {
        return this.productService.addProductImage(req.user.id, productId, dto);

    }


    @Delete('products/:productId/images/:imageId')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async deleteProductImage
        (
            @Req() req,
            @Param('productId', ParseIntPipe) productId: number,
            @Param('imageId', ParseIntPipe) imageId: number
        ) {
        return this.productService.removeProductImage(req.user.id, productId, imageId);
    }

    @Delete('products/:productId/images')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async deleteAllProductImages
        (
            @Req() req,
            @Param('productId', ParseIntPipe) productId: number,
        ) {
        return this.productService.clearProductImages(req.user.id, productId);
    }

    //tags

    @Post('products/:id/tags')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async attachProductTags
        (
            @Req() req,
            @Param('id', ParseIntPipe) productId: number,
            @Body() dto: AttachTagsDto
        ) {
        return this.productService.attachTags(req.user.id, productId, dto.tagIds);
    }

    @Delete('products/:id/tags')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
    async detachProductTags
        (
            @Req() req,
            @Param('id', ParseIntPipe) productId: number,
            @Body() dto: RemoveTagsDto
        ) {
        return this.productService.detachTags(req.user.id, productId, dto.tagIds);
    }

   @Delete('products/:id/tags/all')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.VENDOR)
async removeAllProductTags(
  @Req() req,
  @Param('id', ParseIntPipe) productId: number,
) {
  return this.productService.removeAllTags(req.user.id, productId);
}








}
