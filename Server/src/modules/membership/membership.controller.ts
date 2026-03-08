import { Controller, Get } from '@nestjs/common';
import { MembershipService } from './membership.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * 公开接口：获取当前可用会员套餐，供 iOS 动态展示
 */
@Controller('membership')
export class MembershipController {
  constructor(private membership: MembershipService) {}

  @Get('plans')
  @Public()
  async plans() {
    return this.membership.getActivePlans();
  }
}
