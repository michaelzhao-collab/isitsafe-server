import { Injectable, Logger } from '@nestjs/common';

/**
 * V5.1 自建 IM 实时连接注册表（与 ws 库解耦）。
 *
 * 设计原则：WebSocket 只是"加速器"，只发"有新消息"的轻信号，不发消息体。
 * 消息体永远走 REST 增量拉取（ChatService.pull）。所以本注册表只负责：
 *   ① 记录 userId → 活跃 socket 集合（判断在线、离线走 APNs）
 *   ② 向指定用户扇出轻信号 { op, groupId, seq }
 *
 * gateway 负责 ws 生命周期并调用 add/remove；service 负责 notify。
 * 二者都依赖本类，互不依赖，避免循环依赖。
 */

/** 能发消息的最小 socket 抽象，避免直接依赖 ws 类型 */
export interface RealtimeSocket {
  send(data: string): void;
  readyState: number;
}

export type RealtimeSignal =
  | { op: 'new'; groupId: string; seq: number }
  | { op: 'update'; groupId: string; seq: number; messageId: string }
  | { op: 'recall'; groupId: string; messageId: string }
  | { op: 'read'; groupId: string; userId: string; seq: number };

const WS_OPEN = 1;

@Injectable()
export class ChatRealtimeService {
  private readonly logger = new Logger(ChatRealtimeService.name);
  /** userId → 该用户当前所有活跃连接（多端） */
  private readonly connections = new Map<string, Set<RealtimeSocket>>();

  add(userId: string, socket: RealtimeSocket): void {
    let set = this.connections.get(userId);
    if (!set) {
      set = new Set();
      this.connections.set(userId, set);
    }
    set.add(socket);
  }

  remove(userId: string, socket: RealtimeSocket): void {
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.connections.delete(userId);
  }

  isOnline(userId: string): boolean {
    const set = this.connections.get(userId);
    if (!set) return false;
    for (const s of set) {
      if (s.readyState === WS_OPEN) return true;
    }
    return false;
  }

  /** 向一组用户扇出信号；返回实际在线送达的用户数 */
  signalUsers(userIds: string[], signal: RealtimeSignal): number {
    const data = JSON.stringify(signal);
    let delivered = 0;
    for (const uid of userIds) {
      const set = this.connections.get(uid);
      if (!set) continue;
      let sentToUser = false;
      for (const socket of set) {
        if (socket.readyState !== WS_OPEN) continue;
        try {
          socket.send(data);
          sentToUser = true;
        } catch (err) {
          this.logger.warn(`signal send failed uid=${uid}: ${String(err)}`);
        }
      }
      if (sentToUser) delivered++;
    }
    return delivered;
  }
}
