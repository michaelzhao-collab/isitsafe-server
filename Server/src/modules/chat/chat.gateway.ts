import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import * as nodeJwt from 'jsonwebtoken';
import { ChatRealtimeService, RealtimeSocket } from './chat-realtime.service';
import { getJwtSecret } from '../../common/jwt-secret.util';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * V5.1 自建 IM WebSocket 网关（挂在同一 HTTP server 的 /chat 路径）。
 *
 * 职责极简：JWT 握手鉴权 → 把 socket 记进注册表 → 心跳保活。
 * 不处理业务消息：收发/同步全部走 REST（ChatController）。WS 只用于服务端下推信号。
 *
 * 客户端：wss://api.starlensai.com/chat?token=<JWT>
 * 心跳：服务端每 20s 发 ping，客户端需在 60s 内有任意帧回应，否则断开（由客户端重连）。
 */

/**
 * 2026-09-07 复核修复：心跳间隔 30s → 20s。
 *
 * 取舍：ChatRealtimeService 的"在线"判定依赖最近一次入站帧的时间戳
 * （STALE_MS=35s）。心跳越密，iOS 挂起后被识别为离线、转走 APNs 的
 * 延迟越短。20s 是 35s 阈值下能容纳一次丢包/重传的最大值。
 * 成本：每连接每分钟 3 帧 ping/pong（原 2 帧），单帧仅 2 字节控制帧，
 * 家庭群规模（每户 ≤10 人）下开销可忽略。
 */
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
/** 已禁用/已删除账号的连接复查间隔（握手已查一次，长连接期间兜底） */
const USER_STATUS_RECHECK_MS = 5 * 60_000;
/** 账号状态缓存 TTL：与 REST 侧 JwtAuthGuard 的 60s 口径一致 */
const USER_STATUS_TTL_MS = 60_000;

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
  /**
   * 2026-09-07 复核修复用：账号状态缓存（userId → 是否可用 + 写入时刻）。
   * 与 REST 侧 JwtAuthGuard 同为 60s TTL；此处独立一份，避免跨模块耦合。
   */
  private readonly userStatusCache = new Map<string, { ok: boolean; at: number }>();
  private lastStatusRecheckAt = Date.now();

  constructor(
    private realtime: ChatRealtimeService,
    private prisma: PrismaService,
  ) {
    this.jwtSecret = getJwtSecret();
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
      this.realtime.touch(client);
    });
    client.on('pong', () => {
      const m = this.meta.get(client);
      if (m) m.lastSeen = Date.now();
      this.realtime.touch(client);
    });
    client.on('close', () => this.cleanup(client));
    client.on('error', () => this.cleanup(client));

    // 2026-09-07 复核修复：原来只验 JWT 签名+过期，被禁用/已删除的账号
    // 凭 7 天有效的 token 仍能握手并持续接收群信号（实测已删除用户可拿到 ready）。
    // 先挂好事件回调再异步查库，避免这段窗口内漏掉 close 事件造成注册表泄漏。
    void this.assertUserUsable(userId).then((ok) => {
      if (ok) {
        this.safeSend(client, JSON.stringify({ op: 'ready' }));
        return;
      }
      this.safeSend(client, JSON.stringify({ op: 'error', reason: 'account_unavailable' }));
      this.cleanup(client);
      try {
        client.close(4403, 'account_unavailable');
      } catch {
        /* noop */
      }
    });
  }

  /** 账号存在且未被禁用（带 60s 缓存）。查库失败时放行，不因 DB 抖动踢掉全部连接。 */
  private async assertUserUsable(userId: string): Promise<boolean> {
    const now = Date.now();
    const cached = this.userStatusCache.get(userId);
    if (cached && now - cached.at < USER_STATUS_TTL_MS) return cached.ok;
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isDisabled: true },
      });
      // 用户不存在（已删号）同样拒绝：REST 侧 guard 对 null 判为未禁用，此处更严
      const ok = !!u && !u.isDisabled;
      this.userStatusCache.set(userId, { ok, at: now });
      if (this.userStatusCache.size > 10_000) this.userStatusCache.clear();
      return ok;
    } catch (err) {
      this.logger.warn(`user status check failed uid=${userId}: ${String(err)}`);
      return true;
    }
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

  /** 定时心跳：超时未见帧则断开；否则发 ping。每 5 分钟顺带复查账号状态。 */
  private sweep(): void {
    const now = Date.now();
    const recheckUsers = now - this.lastStatusRecheckAt >= USER_STATUS_RECHECK_MS;
    if (recheckUsers) {
      this.lastStatusRecheckAt = now;
      // 复查前清空缓存，否则 60s TTL 内会命中旧结果，禁用动作最长要 5 分钟才生效
      this.userStatusCache.clear();
    }

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
      // 2026-09-07 复核修复：长连接期间账号被禁用/删号时主动断开，
      // 否则该连接在 token 有效期内（7 天）持续接收家庭群信号。
      if (recheckUsers) {
        const userId = m.userId;
        void this.assertUserUsable(userId).then((ok) => {
          if (ok) return;
          this.cleanup(client);
          try {
            client.close(4403, 'account_unavailable');
          } catch {
            /* noop */
          }
        });
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
