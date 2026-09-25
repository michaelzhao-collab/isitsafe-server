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

/**
 * 2026-09-07 复核修复：判定"在线"的最大静默时长。
 *
 * 问题：iOS 进后台被挂起时不会发 FIN，socket 的 readyState 仍是 OPEN，
 * 服务端据此判定"在线" → 信号写进僵尸 socket、跳过 APNs → 用户在
 * 心跳硬超时（60s）前发来的消息既收不到信号也收不到推送。
 *
 * 修法：在线 = readyState OPEN **且** 最近一次收到该 socket 的帧/pong 在
 * STALE_MS 内。取值须 > 心跳间隔（20s）留出网络往返余量，35s 给足 1 个
 * 心跳周期 + 15s 抖动；超过即视为离线走 APNs（socket 本身保留到 60s
 * 硬超时，客户端唤醒后仍可复用，不会造成额外重连）。
 */
const STALE_MS = 35_000;

@Injectable()
export class ChatRealtimeService {
  private readonly logger = new Logger(ChatRealtimeService.name);
  /** userId → 该用户当前所有活跃连接（多端） */
  private readonly connections = new Map<string, Set<RealtimeSocket>>();
  /** socket → 最近一次收到入站帧/pong 的时间戳（在线判定用，见 STALE_MS） */
  private readonly lastSeen = new WeakMap<RealtimeSocket, number>();

  add(userId: string, socket: RealtimeSocket): void {
    let set = this.connections.get(userId);
    if (!set) {
      set = new Set();
      this.connections.set(userId, set);
    }
    set.add(socket);
    this.lastSeen.set(socket, Date.now());
  }

  remove(userId: string, socket: RealtimeSocket): void {
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.connections.delete(userId);
  }

  /** gateway 收到任意入站帧/pong 时调用，刷新该连接的存活时间 */
  touch(socket: RealtimeSocket): void {
    this.lastSeen.set(socket, Date.now());
  }

  /** 该 socket 是否可用于"免推送"的实时投递（OPEN 且未静默超时） */
  private isFresh(socket: RealtimeSocket, now: number): boolean {
    if (socket.readyState !== WS_OPEN) return false;
    const seen = this.lastSeen.get(socket);
    // 没有记录（理论上 add 时已写入）按新鲜处理，避免误判离线导致重复推送
    if (seen == null) return true;
    return now - seen <= STALE_MS;
  }

  isOnline(userId: string): boolean {
    const set = this.connections.get(userId);
    if (!set) return false;
    const now = Date.now();
    for (const s of set) {
      if (this.isFresh(s, now)) return true;
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
