import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create_order.dto';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Role } from 'src/common/enums/role.enum';


@Controller('order')
export class OrderController 
{
    constructor(private readonly orderService: OrderService){}

    @Get('test-error')
testError() {
  throw new Error('Something broke');
}


    @Post('/:vendorId')
    @UseGuards(AuthGuard('jwt'))
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

   
    





}
