import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()

export class SessionService 
{
    constructor(private readonly prisma: PrismaService) {}

    async markOnline(userId: number)
    {
        await this.prisma.user.update({
            where: { id: userId },
            data: { 
                isOnline: true,
                lastSeenAt: new Date()
             },
        });
    }

    async markOffline(userId:number) 
    {
        return  this.prisma.user.update({
            where: {id:userId},
            data: 
            {
                isOnline:false,
                lastSeenAt: new Date()
            }

        });

    }
    async heartbeat(userId: number)
    {
        await this.prisma.user.update({
            where: {id:userId},
            data: {lastSeenAt: new Date()}
        });
    }
}