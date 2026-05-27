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
import { FamilyService } from './family.service';
import {
  CreateFamilyGroupDto,
  RedeemInviteDto,
  UpdatePreferencesDto,
  BroadcastDto,
} from './dto/create-group.dto';

/**
 * V3-E 家庭守护接口
 *
 * 路由前缀：/api/v3/family
 * 全部需要登录（JwtAuthGuard）
 *
 * 一期范围（12 个接口）：
 *  POST   /groups                       创建家庭组
 *  GET    /groups/me                    我的家庭组
 *  POST   /groups/:id/invites           生成邀请码
 *  POST   /invites/redeem               兑换邀请码
 *  DELETE /groups/:id/members/:userId   移除成员（owner）
 *  POST   /groups/:id/leave             退出
 *  DELETE /groups/:id                   解散（owner）
 *  PUT    /members/me/preferences       同步偏好
 *  POST   /broadcast                    主动分享（W5 实现，stub 阶段返回 501）
 *  GET    /broadcasts                   家庭官方消息
 *  GET    /members/status               成员活跃状态（聚合）
 *  PUT    /members/:userId/elder-mode   远程开启长辈模式（W6 实现）
 */
@Controller('v3/family')
@UseGuards(JwtAuthGuard)
export class FamilyController {
  constructor(private family: FamilyService) {}

  // ====== 家庭组 CRUD ======
  @Post('groups')
  async createGroup(@CurrentUser('sub') userId: string, @Body() dto: CreateFamilyGroupDto) {
    const group = await this.family.createGroup(userId, dto.name);
    return { id: group.id, name: group.name };
  }

  @Get('groups/me')
  async getMyGroup(@CurrentUser('sub') userId: string) {
    return this.family.getMyGroup(userId);
  }

  @Post('groups/:id/leave')
  async leaveGroup(@CurrentUser('sub') userId: string) {
    await this.family.leaveGroup(userId);
    return { success: true };
  }

  @Delete('groups/:id')
  async dissolveGroup(@CurrentUser('sub') userId: string, @Param('id') groupId: string) {
    await this.family.dissolveGroup(userId, groupId);
    return { success: true };
  }

  @Delete('groups/:id/members/:userId')
  async removeMember(
    @CurrentUser('sub') currentUserId: string,
    @Param('id') groupId: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.family.removeMember(currentUserId, groupId, targetUserId);
    return { success: true };
  }

  // ====== 邀请码 ======
  @Post('groups/:id/invites')
  async generateInvite(@CurrentUser('sub') userId: string, @Param('id') groupId: string) {
    return this.family.generateInviteCode(userId, groupId);
  }

  @Post('invites/redeem')
  async redeemInvite(@CurrentUser('sub') userId: string, @Body() dto: RedeemInviteDto) {
    const member = await this.family.redeemInviteCode(userId, dto.inviteCode);
    return { groupId: member.groupId, joinedAt: member.joinedAt };
  }

  // ====== 隐私 ======
  @Put('members/me/preferences')
  async updatePreferences(@CurrentUser('sub') userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.family.updatePreferences(userId, dto);
  }

  // ====== 官方广播 ======
  @Get('broadcasts')
  async getBroadcasts(@CurrentUser('sub') userId: string, @Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.family.getMyBroadcasts(userId, Math.min(n, 100));
  }

  /**
   * V3-E 主动分享：用户在 App 输入一条信息 → AI 检测 → 按结果以"官方"名义广播给家庭
   * 不在家庭组、当日已发同内容、配额耗尽 都会返回特定 skipReason
   */
  @Post('broadcast')
  async createBroadcast(
    @CurrentUser('sub') userId: string,
    @Body() dto: BroadcastDto,
  ) {
    const validTypes = ['phone', 'url', 'sms', 'voice'] as const;
    const t = (dto.contentType ?? '').toLowerCase();
    if (!validTypes.includes(t as any)) {
      return { delivered: false, error: 'invalid contentType' };
    }
    return this.family.createBroadcast({
      triggeredByUserId: userId,
      contentType: t as 'phone' | 'url' | 'sms' | 'voice',
      content: dto.content,
      source: 'manual_share',
    });
  }

  @Get('members/status')
  async getMembersStatus(@CurrentUser('sub') userId: string) {
    // 当前 GET /groups/me 已含活跃状态；此接口为前端轮询场景预留
    const group = await this.family.getMyGroup(userId);
    if (!group) return { members: [] };
    return { members: group.members };
  }

  /**
   * 监护人远程开启/关闭被监护人长辈模式
   * PUT /api/v3/family/members/:userId/elder-mode
   * body: { enabled: boolean }
   *
   * 权限：调用者必须是同家庭组的 owner 或 guardian；
   *       target 必须在该家庭组内
   */
  @Put('members/:userId/elder-mode')
  async setMemberElderMode(
    @CurrentUser('sub') currentUserId: string,
    @Param('userId') targetUserId: string,
    @Body() body: { enabled?: boolean },
  ) {
    const enabled = !!body?.enabled;
    return this.family.setMemberElderMode(currentUserId, targetUserId, enabled);
  }
}
