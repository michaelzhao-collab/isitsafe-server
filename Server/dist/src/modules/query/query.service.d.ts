import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
export declare class QueryService {
    private prisma;
    private redis;
    constructor(prisma: PrismaService, redis: RedisService);
    private cacheKey;
    queryPhone(phone: string, userId?: string): Promise<any>;
    queryUrl(url: string, userId?: string): Promise<any>;
    queryCompany(name: string, userId?: string): Promise<any>;
    queryBatch(requests: {
        type: 'phone' | 'url' | 'company';
        content: string;
    }[]): Promise<any[]>;
    getTags(): Promise<any>;
}
