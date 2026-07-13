import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { ChatModerationService } from './chat-moderation.service';
import {
  PullMessagesDto,
  ReadCursorDto,
  RecallMessageDto,
  ReportMessageDto,
  SendMessageDto,
} from './dto/chat.dto';

/**
 * V5.1 自建 IM 家庭群聊 REST 接口。
 * 全部 /api/chat/*，需登录。消息体的收发/同步全部走这里；WebSocket 只发信号。
 */
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chat: ChatService,
    private moderation: ChatModerationService,
  ) {}

  /** 发送消息（幂等：同 clientMsgId 返回原消息） */
  @Post('groups/:groupId/messages')
  send(
    @CurrentUser('sub') userId: string,
    @Param('groupId') groupId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chat.sendMessage(userId, groupId, dto);
  }

  /** 增量拉取 / 历史回溯：afterSeq（增量）或 beforeSeq（历史），都不传则最近 N 条 */
  @Get('groups/:groupId/messages')
  pull(
    @CurrentUser('sub') userId: string,
    @Param('groupId') groupId: string,
    @Query() q: PullMessagesDto,
  ) {
    return this.chat.pull(userId, groupId, {
      afterSeq: q.afterSeq,
      beforeSeq: q.beforeSeq,
      limit: q.limit,
    });
  }

  /** 推进已读游标（只增不减） */
  @Put('groups/:groupId/read-cursor')
  read(
    @CurrentUser('sub') userId: string,
    @Param('groupId') groupId: string,
    @Body() dto: ReadCursorDto,
  ) {
    return this.chat.updateReadCursor(userId, groupId, dto.seq);
  }

  /** 撤回消息（本人 2 分钟内） */
  @Post('groups/:groupId/recall')
  recall(
    @CurrentUser('sub') userId: string,
    @Param('groupId') groupId: string,
    @Body() dto: RecallMessageDto,
  ) {
    return this.chat.recall(userId, groupId, dto.messageId);
  }

  /** 我所有家庭的未读汇总（家庭 Tab 角标 / 切换 sheet） */
  @Get('unread-summary')
  unread(@CurrentUser('sub') userId: string) {
    return this.chat.unreadSummary(userId);
  }

  /** 某群各成员已读游标（§7-4 已读名单"女儿已读"） */
  @Get('groups/:groupId/read-states')
  readStates(@CurrentUser('sub') userId: string, @Param('groupId') groupId: string) {
    return this.chat.readStates(userId, groupId);
  }

  // ====== 合规：举报 / 拉黑 ======

  /** 举报一条消息 */
  @Post('report')
  report(@CurrentUser('sub') userId: string, @Body() dto: ReportMessageDto) {
    return this.moderation.report(userId, {
      groupId: dto.groupId,
      messageId: dto.messageId,
      reason: dto.reason,
    });
  }

  /** 屏蔽某成员的消息 */
  @Post('block/:userId')
  block(@CurrentUser('sub') me: string, @Param('userId') target: string) {
    return this.moderation.block(me, target);
  }

  /** 解除屏蔽 */
  @Delete('block/:userId')
  unblock(@CurrentUser('sub') me: string, @Param('userId') target: string) {
    return this.moderation.unblock(me, target);
  }

  /** 我屏蔽的用户 id 列表（客户端渲染过滤） */
  @Get('blocked')
  blocked(@CurrentUser('sub') userId: string) {
    return this.moderation.blockedUserIds(userId);
  }
}
