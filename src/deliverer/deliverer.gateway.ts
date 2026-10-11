import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DelivererJobService } from './deliverer-job.service';
import { GlobalWsExceptionFilter } from '../common/filters/ws-exception.filter';
import { ReconnectService } from '../common/websocket/reconnect.service';
import { ReplayService } from '../common/websocket/reply.service';
import { SessionService } from '../common/websocket/session.service';
import { DelivererLocationService } from './deliverer-location-service';
import { AppLogger } from '../common/logger/app-logger.service';

@WebSocketGateway({ namespace: 'deliverer', cors: true })
@UseFilters(GlobalWsExceptionFilter)
export class DelivererGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly delivererJobService: DelivererJobService,
    private readonly reconnectService: ReconnectService,
    private readonly sessionService: SessionService,
    private readonly replayService: ReplayService,
    private readonly locationService: DelivererLocationService,
    private readonly logger: AppLogger,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) return client.disconnect();

      const payload = this.jwtService.verify(token);
      if (payload.role !== 'DELIVERER') return client.disconnect();

      const deliverer = await this.delivererJobService.getDelivererByUserId(payload.sub);

      const missedEvents = await this.replayService.replayForDeliverer(deliverer.id);
      await this.sessionService.markOnline(payload.sub);

      client.data.userId = payload.sub;
      client.data.delivererId = deliverer.id;
      client.join(`deliverer:${deliverer.id}`);

      const context = await this.reconnectService.getDelivererContext(deliverer.id);
      if (context?.data?.jobId) client.join(`job:${context.data.jobId}`);

      client.emit('session.context', {
        session: { role: 'DELIVERER', entityId: deliverer.id },
        ...context,
      });
      if (missedEvents.length) client.emit('events.replay', missedEvents);

      this.logger.log('DelivererConnected', { delivererId: deliverer.id, missedEvents: missedEvents.length });
    } catch (error) {
      this.logger.warn('DelivererConnectionRejected', { socketId: client.id, error });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const { userId, delivererId } = client.data;
    if (!userId) return;

    try {
      await this.sessionService.markOffline(userId);
      if (delivererId) await this.locationService.flushToDb(delivererId);
    } catch (error) {
      this.logger.error('DelivererDisconnectCleanupFailed', { userId, delivererId, error });
    }
    this.logger.log('DelivererDisconnected', { delivererId });
  }

  sendJobAssigned(delivererId: number, job: any) {
    this.server.to(`deliverer:${delivererId}`).emit('job:assigned', {
      event: 'JOB_ASSIGNED', data: job, timestamp: new Date(),
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
      client.emit('job:error', { error: err });
      this.logger.error('JobStartFailed', { delivererId: client.data.delivererId, jobId: data.jobId, error: err });
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
      client.emit('dropoff:error', {message: err });
      this.logger.error('DropoffCompletionFailed', { delivererId: client.data.delivererId, jobId: data.jobId, dropOffId: data.dropOffId, error: err });
    }
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId?: number; lat: number; lng: number },
  ) {
    const delivererId = client.data.delivererId;
    if (!delivererId || !this.locationService.isValid(data.lat, data.lng)) return;

    await this.locationService.update(delivererId, data.lat, data.lng);

    if (data.jobId && (await this.delivererJobService.validateLiveTracking(data.jobId, delivererId))) {
      this.server.to(`job:${data.jobId}`).emit('location:update', {
        lat: data.lat, lng: data.lng, timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('session.heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;
    await this.sessionService.heartbeat(userId);
  }
}