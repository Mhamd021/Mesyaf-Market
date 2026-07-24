import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';


@Module({
  imports: [CommonModule,UsersModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
