import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket, } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { DelivererJobService } from './deliverer-job.service';

@WebSocketGateway({ namespace: 'deliverer', cors: true })
export class DelivererGateway implements OnGatewayConnection, OnGatewayDisconnect {

  @WebSocketServer()
  server: Server;


  private readonly logger = new Logger(DelivererGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly delivererJobService: DelivererJobService,) { }

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.query?.token;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify(token);

      if (payload.role !== 'DELIVERER') {
        client.disconnect();
        return;
      }

      const deliverer = await this.prisma.delivererProfile.findUnique({
        where: { userId: payload.sub },
      });

      if (!deliverer) {
        client.disconnect();
        return;
      }

      client.data.delivererId = deliverer.id;

      client.emit('connected', {
        message: 'Welcome deliverer',
      });

      const room = `deliverer:${deliverer.id}`;
      client.join(room);
      this.server.to(room).emit('room:test', {
        message: 'You are inside the room',
        room: room,
      });
      this.logger.log(`Deliverer ${deliverer.id} connected`);
    } catch {
      client.disconnect();
    }
  }


  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }



  sendJobAssigned(delivererId: number, job: any) {
    const room = `deliverer:${delivererId}`;
    this.server.to(room).emit('job:assigned',
      {
        type: "JOB_ASSIGNED",
        job,
        timestamp: new Date()
      });
    this.logger.log(`Job assigned event sent to deliverer ${delivererId}`);
  }

  @SubscribeMessage('job:start')
  async handleStartJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: number },
  ) {

    const delivererId = client.data.delivererId;
    try {
      const result = await this.delivererJobService.startJob(data.jobId, delivererId);
      client.emit('job:started', result);
    } catch (err) {
      client.emit('job:error', { message: err.message });
    }
  }

  @SubscribeMessage('dropoff:complete')
  async handleCompleteDropoff(@ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: number; dropOffId: number },) 
    {
    const delivererId = client.data.delivererId;  
    try {
      const result = await this.delivererJobService.completeDropOff(data.jobId, data.dropOffId, delivererId);
      client.emit('dropoff:completed', result);
      if (result.jobCompleted) {
        client.emit('job:completed', { jobId: data.jobId });
      }
    }
    catch (err) 
    {
      client.emit('dropoff:error', { message: err.message });
    }


  }

}
