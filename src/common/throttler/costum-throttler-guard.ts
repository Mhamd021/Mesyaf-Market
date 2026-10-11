import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import * as throttler from "@nestjs/throttler";

@Injectable()
export class CostumThrottlerGuard extends throttler.ThrottlerGuard
{
    constructor(
    options: throttler.ThrottlerModuleOptions,
    storageService: throttler.ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService, 
  ) {
    super(options, storageService, reflector);
  }
  protected async getTracker(req: Record<string, any>): Promise<string> {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    const user = this.jwtService.verify(token);

    if (user && user['sub']) {
      return `user-${user['sub']}`;
    }
  } catch {
  }

  return `ip-${req.ip}`;
}
 async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true; 
    return super.canActivate(context);
  }
}