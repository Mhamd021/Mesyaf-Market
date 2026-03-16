import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { VendorService } from './vendor.service';
import { ReconnectService } from 'src/common/websocket/reconnect.service';
import { Logger, UseFilters } from '@nestjs/common';
import { SessionService } from 'src/common/websocket/session.service';
import { ReplayService } from 'src/common/websocket/reply.service';
import { GlobalWsExceptionFilter } from 'src/common/filters/ws-exception.filter';

@WebSocketGateway({ namespace: 'vendor', cors: true })
@UseFilters(GlobalWsExceptionFilter)
export class VendorGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;


  private readonly logger = new Logger(VendorGateway.name);

  constructor(private readonly jwtservice: JwtService, private readonly vendor: VendorService,
    private readonly reconnectService: ReconnectService,
    private readonly sessionService: SessionService,
    private readonly replayService: ReplayService

  ) { }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) return client.disconnect();
    const payload = this.jwtservice.verify(token);

    if (payload.role !== 'VENDOR') return client.disconnect();
    await this.sessionService.markOnline(payload.sub);

    const vendor = await this.vendor.getProfileByUserId(payload.sub);

    if (!vendor) return client.disconnect();


    client.data.userId = payload.sub;
    client.data.vendorId = vendor.id;

    const room = `vendor:${vendor.id}`;
    client.join(room);

    const context = await this.reconnectService.getVendorContext(vendor.id);

    client.emit('session.context', {
  session: {
    role: 'VENDOR',
    entityId: vendor.id,
    },
    ...context,
  });

    const missedEvents = await this.replayService.replayForVendor(vendor.id);
    if (missedEvents.length) {
      client.emit('events.replay', missedEvents);
    }

  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const vendorId = client.data.vendorId
    if (!userId) return;

    await this.sessionService.markOffline(userId);

    this.logger.warn(`Vendor ${vendorId} disconnected`);
  }


  sendNewOrder(vendorId: number, order) {
    this.server.to(`vendor:${vendorId}`).emit('order:new', {
      type: 'ORDER_NEW',
      order,
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
