import { JwtService } from '@nestjs/jwt';
import { SubscribeMessage, WebSocketGateway, ConnectedSocket, MessageBody, WebSocketServer, } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { DeliveryJobSubscriptionService } from './delivery-job-subscription.service';
import { ReconnectService } from 'src/common/websocket/reconnect.service';
import { Logger } from '@nestjs/common/services/logger.service';
import { SessionService } from 'src/common/websocket/session.service';
import { ReplayService } from 'src/common/websocket/reply.service';

@WebSocketGateway({ namespace: 'customer', cors: true })
export class CustomerGateway {
  private readonly logger = new Logger(CustomerGateway.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly subscriptionService: DeliveryJobSubscriptionService,
    private readonly reconnectService: ReconnectService,
    private sessionService: SessionService,
    private replayService: ReplayService

  ) { }

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) return client.disconnect();

      const payload = this.jwtService.verify(token);
       
     

      if (payload.role !== 'CUSTOMER') {
        return client.disconnect();
      }
     await this.sessionService.markOnline(payload.sub);

      const customerId = payload.sub;
      client.data.customerId = customerId;

      client.join(`customer:${customerId}`);

      const context = await this.reconnectService.getCustomerContext(customerId);

      if (context?.data?.jobId) {
        
        client.join(`job:${context.data.jobId}`);
        this.logger.log(
          `Customer ${customerId} connected with context: ${context?.data?.orderId ?? 'none'}`
        );

      }

      client.emit('session.context', {
  session: {
    role: 'CUSTOMER',
    entityId: customerId,
    },
    ...context,
  });

      const missedEvents = await this.replayService.replayForCustomer(customerId);
    if (missedEvents.length) {
      client.emit('events.replay', missedEvents);
    }

    } catch (err) {
      client.disconnect();
    }
  }
  async handleDisconnect(client: Socket) {
  const customerId = client.data.customerId;
  if (!customerId) return;

  await this.sessionService.markOffline(customerId);

  this.logger.warn(`Customer ${customerId} disconnected`);
}


  @SubscribeMessage('job:subscribe')
  async handleJobSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId: number },
  ) {
    try {
      const customerId = client.data.customerId;

      await this.subscriptionService.subscribeCustomerToJob(
        customerId,
        data.jobId,
      );

      const room = `job:${data.jobId}`;
      if (!client.rooms.has(room)) {
        client.join(room);
      }

      client.emit('job:subscribed', { jobId: data.jobId });
    } catch (err) {
      client.emit('job:error', { message: err.message });
    }
  }

  sendOrderAccepted(customerId: number, orderId: number) {
    this.server.to(`customer:${customerId}`).emit('order:accepted', {
      orderId,
      status: 'VENDOR_ACCEPTED',
    });
  }

  sendOrderRejected(customerId: number, orderId: number) {
    this.server.to(`customer:${customerId}`).emit('order:rejected', {
      orderId,
      status: 'VENDOR_REJECTED',
    });
  }

  sendOrderReady(customerId: number, orderId: number) {
    this.server.to(`customer:${customerId}`).emit('order:ready', {
      orderId,
      status: 'READY_FOR_DELIVERY',
    });
  }

  sendDelivererAssigned(
    customerId: number,
    jobId: number,
    delivererId: number,
  ) {
    this.server.to(`customer:${customerId}`).emit('delivery:assigned', {
      jobId,
      delivererId,
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
