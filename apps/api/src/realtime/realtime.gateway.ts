import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { verify } from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface JwtPayload {
  sub: string;
  role: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || 
                    client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = verify(token, process.env.JWT_SECRET || 'secret') as JwtPayload;
      client.userId = payload.sub;
      client.userRole = payload.role;

      // Join user-specific room
      client.join(`user:${client.userId}`);
      
      // Join role-specific room
      client.join(`role:${client.userRole}`);

      // Track socket
      const userId = client.userId;
      if (userId) {
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(client.id);
      }

      this.logger.log(`Client ${client.id} connected as user ${client.userId}`);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = client.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(client: AuthenticatedSocket, conversationId: string) {
    client.join(`conversation:${conversationId}`);
    this.logger.log(`Client ${client.id} joined conversation ${conversationId}`);
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(client: AuthenticatedSocket, conversationId: string) {
    client.leave(`conversation:${conversationId}`);
    this.logger.log(`Client ${client.id} left conversation ${conversationId}`);
  }

  // Methods to emit events from other services
  sendToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  sendToRole(role: string, event: string, data: any) {
    this.server.to(`role:${role}`).emit(event, data);
  }

  sendToConversation(conversationId: string, event: string, data: any) {
    this.server.to(`conversation:${conversationId}`).emit(event, data);
  }

  sendToAgent(agentId: string, event: string, data: any) {
    this.sendToUser(agentId, event, data);
  }

  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }
}
