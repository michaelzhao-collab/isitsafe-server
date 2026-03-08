import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
import { MembershipService } from '../../modules/membership/membership.service';
export declare class AiRateLimitGuard implements CanActivate {
    private redis;
    private reflector;
    private membership;
    constructor(redis: RedisService, reflector: Reflector, membership: MembershipService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
