import { Controller, Get, Param, ParseIntPipe, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Role } from '../enums/role.enum';
import { Roles } from "../decorators/roles.decorator";
import { RolesGuard } from '../guards/roles.guard';
import { JobTimelineQueryService } from "./job-timeline.query.service";
import { OrderTimelineQueryService } from "./order-timeline.query.service";



@Controller('timeline')
export class TimeLineController
{

  constructor(private readonly orderTimeLineService:OrderTimelineQueryService, private readonly jobTimelineService: JobTimelineQueryService) {}

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.DELIVERER,Role.ADMIN)
@Get(':jobId/job')
getJobTimeline(
     @Param('jobId', ParseIntPipe) jobId: number,
    @Req() req: any,
) {

  return this.jobTimelineService.getJobTimeline(
      jobId,
      req.user,
    );
}


@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.CUSTOMER, Role.VENDOR,Role.ADMIN)
@Get(':orderId/order')

getOrderTimeline
(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Req() req: any,
)
{
    return this.orderTimeLineService.getOrderTimeline(orderId,req.user);
}



}