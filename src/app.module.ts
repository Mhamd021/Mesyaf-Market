import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { VendorModule } from './vendor/vendor.module';
import { ProductModule } from './product/product.module';
import { CommonModule } from './common/common.module';
import { AdminModule } from './admin/admin.module';
import { OrderModule } from './order/order.module';
import { DelivererModule } from './deliverer/deliverer.module';
import { TimeLineModule } from './common/timeline/timeline.module';
import { RecoveryModule } from './common/decorators/recovery/recovery.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health/health.controller';
import { EventsModule } from './common/events/events.module';
import { WebsocketModule } from './common/websocket/websocket.module';
import { LoggerModule } from './common/logger/app-logger.module';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './common/redis/redis.module';
import { BullMQModule } from './common/bullmq/bullmq.module';
import {  ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { RedisService } from './common/redis/redis.service';
import { CostumThrottlerGuard } from './common/throttler/costum-throttler-guard';




@Module({
  imports: [

    WebsocketModule,
    LoggerModule,
    RedisModule,
    BullMQModule,
    UsersModule, AuthModule, VendorModule, ProductModule, CommonModule, AdminModule, OrderModule, DelivererModule,TimeLineModule,RecoveryModule,EventsModule,
     ScheduleModule.forRoot(),
     ConfigModule.forRoot({
      isGlobal: true, 
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject:[RedisService],
      useFactory: (redisService: RedisService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,   
            limit: 10,
          },
          {
            name: 'login',
            ttl: 900000,
            limit: 5,
          },
        ],
        storage: new RedisThrottlerStorage(redisService),
      }),
    })
    
  ],
  controllers: [AppController,HealthController],
  providers: [AppService,RedisThrottlerStorage,
    {
      provide : 'APP_GUARD',
      useClass : CostumThrottlerGuard
    }
  ],
  
})
export class AppModule {}
