import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create_order.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '../common/enums/role.enum';
import { Throttle } from '@nestjs/throttler';



@Controller('order')
export class OrderController 
{
    constructor(private readonly orderService: OrderService){}

    @Get('test-error')
testError() {
  throw new Error('Something broke');
}
    @UseGuards(AuthGuard('jwt'))
    @Throttle({ default: {limit:10,ttl:60000}})
    @Post('/:vendorId')
    async createOrder(@Req()req ,@Param('vendorId', ParseIntPipe) vendorId: number ,@Body() dto: CreateOrderDto)
    {
        return this.orderService.createOrder(dto , vendorId , req.user.id);
        
    }





    @Patch('/markeReady/:orderId')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.VENDOR)
     async markOrderReady(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req
    ) {
        return this.orderService.vendorMarkReady(orderId,req.user.id);
    }

   @Get('test-batch/:batchId')
@UseGuards(AuthGuard('jwt'))
async testBatch(@Param('batchId') batchId: string) {
  await this['orderService']['closeBatch'](+batchId);
  return { message: 'closeBatch triggered', batchId: +batchId };
}
    





}
