import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChatService } from './chat.service';

interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
}

interface SocketUserData {
  userId: string;
  employeeId: string;
  organizationId: string;
}

const REDIS_ROOM_CHANNEL_PATTERN = 'chat:room:*';
const redisChannelForRoom = (roomId: string): string => `chat:room:${roomId}`;

/**
 * Chat gateway — namespace `/chat`.
 *
 * These events are NOT part of the OpenAPI/Swagger contract (Socket.io is a
 * separate transport). Documenting them here since this is the only place
 * they're specified:
 *
 * Handshake:
 *   - Client connects with `handshake.auth.token` (fallback: `Authorization`
 *     header, `Bearer <token>`). Token is verified with the SAME jwt.secret
 *     and user-lookup path as `JwtStrategy` (reject if user missing/inactive).
 *   - Auth runs in a Socket.io NAMESPACE MIDDLEWARE (`server.use(...)`,
 *     registered in `onModuleInit`), NOT in `handleConnection`. This is
 *     deliberate: `OnGatewayConnection#handleConnection` runs AFTER the
 *     server has already accepted the connection and sent the client its
 *     `connect` event — so a client can legally emit `chat:join`/`chat:message`
 *     in the window before an async `handleConnection` finishes verifying the
 *     JWT. If any handler reads `client.data.employeeId` during that window
 *     it gets `undefined`, and passing `undefined` into a Prisma `where`
 *     filter does NOT fail closed — Prisma silently DROPS an
 *     undefined-valued key, turning `{ roomId, employeeId: undefined }` into
 *     an unscoped `{ roomId }` query that matches ANY active member of the
 *     room. That combination is an auth bypass: an unauthenticated/unverified
 *     socket could get `chat:join` `ok:true` for a room it has no membership
 *     in. A namespace middleware runs BEFORE the connection is established —
 *     calling `next(new Error(...))` rejects the handshake outright, so the
 *     client only ever sees `connect` once `socket.data` is already fully
 *     populated. On failure the client gets `connect_error` and no
 *     `connect` fires at all.
 *   - On success, `{ userId, employeeId, organizationId }` is stashed on
 *     `client.data` by the middleware before `next()` is called.
 *
 * Client -> Server:
 *   - `chat:join`    `{ roomId }` — verifies active membership, joins the
 *                     Socket.io room named `roomId`, acks `{ roomId, ok: true }`.
 *   - `chat:message` `{ roomId, content }` — verifies active membership,
 *                     persists via `ChatService.sendMessage`, publishes the
 *                     denormalized message to Redis channel `chat:room:{roomId}`
 *                     (see pub/sub fan-out below). Acks the created message.
 *   - `chat:typing`  `{ roomId }` (optional) — broadcasts `chat:typing`
 *                     `{ roomId, employeeId }` to the room. Not persisted.
 *   - `chat:read`    `{ roomId, messageId }` (optional) — broadcasts `chat:read`
 *                     `{ roomId, messageId, employeeId }` to the room. Not persisted.
 *
 * Server -> Client:
 *   - `chat:message:new` — a denormalized `ChatMessage` (see
 *     `ChatService`'s `toMessageResponse` shape).
 *   - `chat:typing`  `{ roomId, employeeId }`
 *   - `chat:read`    `{ roomId, messageId, employeeId }`
 *   - `chat:error`   `{ message }` — emitted instead of throwing, so a bad
 *     event never kills the socket.
 *
 * Multi-instance fan-out: `chat:message` handlers publish to Redis instead of
 * emitting directly to `server.to(roomId)`. A single subscriber connection
 * (created once in `onModuleInit` via `redisService.createSubscriber()`)
 * `psubscribe`s `chat:room:*` and re-emits `chat:message:new` to
 * `server.to(roomId)` on EVERY instance — including the instance that
 * originally published — so all connected sockets in the room (regardless of
 * which Node process they're attached to) receive the message exactly once
 * per instance's local room membership.
 *
 * IMPORTANT — use `OnModuleInit`, NOT `OnGatewayInit`/`afterInit`, for any
 * setup that depends on another provider's `onModuleInit` having already run
 * (e.g. `RedisService.client`). Nest's `NestApplication.init()` calls
 * `registerWsModule()` (which fires every gateway's `afterInit`) BEFORE
 * `callInitHook()` (which runs all providers' `onModuleInit`, including
 * `RedisService`'s, where `redis.client` is actually constructed). A gateway
 * that reads another provider's post-`onModuleInit` state inside `afterInit`
 * will always see it `undefined` and crash app startup. `OnModuleInit` on the
 * gateway itself participates in the normal dependency-ordered init hook
 * sequence and is safe to use instead. `this.server` (bound by
 * `@WebSocketServer()`) IS already available by this point regardless, since
 * that binding happens during the same `registerWsModule()` pass.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: '*', credentials: true } })
export class ChatGateway implements OnGatewayDisconnect, OnModuleInit {
  private readonly logger = new Logger(ChatGateway.name);
  private subscriber: Redis;

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly chatService: ChatService,
  ) {}

  onModuleInit(): void {
    // Auth middleware — runs BEFORE the connection is accepted (see class
    // comment above for why this must not live in `handleConnection`).
    this.server.use((socket: Socket, next: (err?: Error) => void) => {
      void this.authenticate(socket)
        .then((data) => {
          socket.data = data;
          next();
        })
        .catch((err: Error) => {
          this.logger.warn(`Chat socket handshake rejected: ${err.message}`);
          next(err);
        });
    });

    this.subscriber = this.redisService.createSubscriber();
    this.subscriber.psubscribe(REDIS_ROOM_CHANNEL_PATTERN, (err) => {
      if (err) this.logger.error(`Failed to psubscribe to ${REDIS_ROOM_CHANNEL_PATTERN}`, err);
    });
    this.subscriber.on('pmessage', (_pattern: string, channel: string, message: string) => {
      const roomId = channel.slice('chat:room:'.length);
      try {
        const payload = JSON.parse(message);
        this.server.to(roomId).emit('chat:message:new', payload);
      } catch (err) {
        this.logger.error(`Failed to parse chat pub/sub payload on ${channel}`, err);
      }
    });
  }

  private async authenticate(client: Socket): Promise<SocketUserData> {
    const token = this.extractToken(client);
    if (!token) throw new Error('Missing auth token');

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.configService.get<string>('jwt.secret'),
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { employee: { select: { id: true } } },
    });

    if (!user || !user.isActive || !user.employee) {
      throw new Error('User account is inactive, missing, or has no employee record');
    }

    return {
      userId: user.id,
      employeeId: user.employee.id,
      organizationId: payload.organizationId,
    };
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Chat socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<{ roomId: string; ok: boolean }> {
    const { employeeId } = this.getUserData(client);
    try {
      await this.chatService.assertActiveMember(body.roomId, employeeId);
      await client.join(body.roomId);
      return { roomId: body.roomId, ok: true };
    } catch (err) {
      client.emit('chat:error', { message: (err as Error).message });
      return { roomId: body.roomId, ok: false };
    }
  }

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; content?: string },
  ): Promise<void> {
    const { employeeId, organizationId, userId } = this.getUserData(client);
    try {
      await this.chatService.assertActiveMember(body.roomId, employeeId);
      const message = await this.chatService.sendMessage(
        organizationId,
        { id: userId, employeeId, permissions: [] },
        body.roomId,
        { content: body.content },
      );
      await this.redisService.publish(redisChannelForRoom(body.roomId), message);
    } catch (err) {
      client.emit('chat:error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('chat:typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ): Promise<void> {
    const { employeeId } = this.getUserData(client);
    try {
      await this.chatService.assertActiveMember(body.roomId, employeeId);
      client.to(body.roomId).emit('chat:typing', { roomId: body.roomId, employeeId });
    } catch (err) {
      client.emit('chat:error', { message: (err as Error).message });
    }
  }

  @SubscribeMessage('chat:read')
  async handleRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string; messageId: string },
  ): Promise<void> {
    const { employeeId } = this.getUserData(client);
    try {
      await this.chatService.assertActiveMember(body.roomId, employeeId);
      client
        .to(body.roomId)
        .emit('chat:read', { roomId: body.roomId, messageId: body.messageId, employeeId });
    } catch (err) {
      client.emit('chat:error', { message: (err as Error).message });
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token as string | undefined;
    if (authToken) return authToken;

    const header = client.handshake.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

    return undefined;
  }

  private getUserData(client: Socket): SocketUserData {
    return client.data as SocketUserData;
  }
}
