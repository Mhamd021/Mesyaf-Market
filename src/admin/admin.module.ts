import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommonModule } from 'src/common/common.module';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [CommonModule,UsersModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
