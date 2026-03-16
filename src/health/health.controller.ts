import { Controller, Get } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
  await this.prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
} catch {
  return { status: 'error', database: 'disconnected' };
}

  }
}
