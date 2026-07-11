import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IncomingMessage } from 'http';
import * as nodeJwt from 'jsonwebtoken';
import { ChatRealtimeService, RealtimeSocket } from './chat-realtime.service';

/**
 * V5.1 自建 IM WebSocket 网关（挂在同一 HTTP server 的 /chat 路径）。
 *
 * 职责极简：JWT 握手鉴权 → 把 socket 记进注册表 → 心跳保活。
 * 不处理业务消息：收发/同步全部走 REST（ChatController）。WS 只用于服务端下推信号。
 *
 * 客户端：wss://api.starlensai.com/chat?token=<JWT>
 * 心跳：服务端每 30s 发 ping，客户端需在 60s 内有任意帧回应，否则断开（由客户端重连）。
 */

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;

// ws 库的 WebSocket 实例（避免强依赖类型，用最小接口 + 运行时属性）
interface WsClient extends RealtimeSocket {
  on(event: string, cb: (...args: any[]) => void): void;
  ping(): void;
  terminate(): void;
  close(code?: number, reason?: string): void;
}

@WebSocketGateway({ path: '/chat' })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);
  private readonly jwtSecret: string;
  /** socket → 绑定的 userId + 最近一次收到帧的时间戳 */
  private readonly meta = new WeakMap<WsClient, { userId: string; lastSeen: number }>();
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly liveSockets = new Set<WsClient>();

  constructor(
    private realtime: ChatRealtimeService,
    private config: ConfigService,
  ) {
    this.jwtSecret = this.config.get('JWT_SECRET', 'secret');
  }

  afterInit(): void {
    this.heartbeatTimer = setInterval(() => this.sweep(), HEARTBEAT_INTERVAL_MS);
    this.logger.log('Chat WebSocket gateway initialized at /chat');
  }

  handleConnection(client: WsClient, request: IncomingMessage): void {
    const token = this.extractToken(request);
    const userId = this.verify(token);
    if (!userId) {
      this.safeSend(client, JSON.stringify({ op: 'error', reason: 'unauthorized' }));
      client.close(4401, 'unauthorized');
      return;
    }
    this.meta.set(client, { userId, lastSeen: Date.now() });
    this.liveSockets.add(client);
    this.realtime.add(userId, client);

    // 任意入站帧刷新存活；客户端可发 {"op":"ping"} 主动保活
    client.on('message', () => {
      const m = this.meta.get(client);
      if (m) m.lastSeen = Date.now();
    });
    client.on('pong', () => {
      const m = this.meta.get(client);
      if (m) m.lastSeen = Date.now();
    });
    client.on('close', () => this.cleanup(client));
    client.on('error', () => this.cleanup(client));

    this.safeSend(client, JSON.stringify({ op: 'ready' }));
  }

  handleDisconnect(client: WsClient): void {
    this.cleanup(client);
  }

  private cleanup(client: WsClient): void {
    const m = this.meta.get(client);
    if (m) this.realtime.remove(m.userId, client);
    this.meta.delete(client);
    this.liveSockets.delete(client);
  }

  /** 定时心跳：超时未见帧则断开；否则发 ping */
  private sweep(): void {
    const now = Date.now();
    for (const client of this.liveSockets) {
      const m = this.meta.get(client);
      if (!m) {
        this.liveSockets.delete(client);
        continue;
      }
      if (now - m.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        this.cleanup(client);
        try {
          client.terminate();
        } catch {
          /* noop */
        }
        continue;
      }
      try {
        client.ping();
      } catch {
        this.cleanup(client);
      }
    }
  }

  private extractToken(request: IncomingMessage): string | null {
    // 1) query ?token=  2) Authorization: Bearer
    try {
      const url = new URL(request.url ?? '', 'http://localhost');
      const q = url.searchParams.get('token');
      if (q) return q;
    } catch {
      /* ignore */
    }
    const auth = request.headers['authorization'];
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }

  private verify(token: string | null): string | null {
    if (!token) return null;
    try {
      const payload = nodeJwt.verify(token, this.jwtSecret) as { sub?: string };
      return payload?.sub ?? null;
    } catch {
      return null;
    }
  }

  private safeSend(client: RealtimeSocket, data: string): void {
    try {
      client.send(data);
    } catch {
      /* noop */
    }
  }
}
