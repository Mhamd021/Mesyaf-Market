import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket, } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DelivererJobService } from './deliverer-job.service';
import { ReconnectService } from 'src/common/websocket/reconnect.service';
import { SessionService } from 'src/common/websocket/session.service';
import { ReplayService } from 'src/common/websocket/reply.service';
import { GlobalWsExceptionFilter } from 'src/common/filters/ws-exception.filter';


@WebSocketGateway({ namespace: 'deliverer', cors: true })
@UseFilters(GlobalWsExceptionFilter)
export class DelivererGateway implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DelivererGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly delivererJobService: DelivererJobService,
    private readonly reconnectService: ReconnectService,
    private readonly sessionService: SessionService,
    private readonly replayService: ReplayService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.query?.token;

      if (!token) return client.disconnect();

      const payload = this.jwtService.verify(token);

      if (payload.role !== 'DELIVERER') {
        return client.disconnect();
      }

      await this.sessionService.markOnline(payload.sub);

      
     

      const deliverer = await this.delivererJobService.getDelivererByUserId(
        payload.sub,
      );
    
      client.data.userId = payload.sub;
      client.data.delivererId = deliverer!.id;

      client.join(`deliverer:${deliverer!.id}`);

      const context =
      await this.reconnectService.getDelivererContext(deliverer!.id);

    if (context?.data?.jobId) {
      client.join(`job:${context?.data?.jobId}`);
    }
     
    client.emit('session.context', {
  session: {
    role: 'DELIVERER',
    entityId: deliverer.id,
    },
    ...context,
  });

    const missedEvents = await this.replayService.replayForDeliverer(deliverer.id);
    if (missedEvents.length) {
      client.emit('events.replay', missedEvents);
    }

    } catch (err) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
  const userId = client.data.userId;
  const delivererId = client.data.delivererId
  if (!userId) return;

  await this.sessionService.markOffline(userId);

  this.logger.warn(`Deliverer ${delivererId} disconnected`);
}


  // 🔔 system event
  sendJobAssigned(delivererId: number, job: any) {
    this.server.to(`deliverer:${delivererId}`).emit('job:assigned', {
      event: 'JOB_ASSIGNED',
      data: job,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('job:start')
  async handleStartJob(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: number },
  ) {
    try {
      const delivererId = client.data.delivererId;

      await this.delivererJobService.startJob(
        data.jobId,
        delivererId,
      );

      client.emit('job:started', { jobId: data.jobId });

      this.server
        .to(`job:${data.jobId}`)
        .emit('delivery:started', { jobId: data.jobId });
    } catch (err) {
      client.emit('job:error', { message: err.message });
    }
  }

  @SubscribeMessage('dropoff:complete')
  async handleCompleteDropoff(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: number; dropOffId: number },
  ) {
    try {
      const delivererId = client.data.delivererId;

      const result =
        await this.delivererJobService.completeDropOff(
          data.jobId,
          data.dropOffId,
          delivererId,
        );

      client.emit('dropoff:completed', result);

      if (result.jobCompleted) {
        this.server
          .to(`job:${data.jobId}`)
          .emit('delivery:completed', { jobId: data.jobId });
      }
    } catch (err) {
      client.emit('dropoff:error', { message: err.message });
    }
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { jobId: number; lat: number; lng: number },
  ) {
    const delivererId = client.data.delivererId;

    const allowed =
      await this.delivererJobService.validateLiveTracking(
        data.jobId,
        delivererId,
      );

    if (!allowed) return;

    this.server.to(`job:${data.jobId}`).emit('location:update', {
      lat: data.lat,
      lng: data.lng,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('session.heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket)
  {
    const userId = client.data.userId;
    if (!userId) return;
    await this.sessionService.heartbeat(userId);
  }
}
