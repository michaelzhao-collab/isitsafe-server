import { PrismaService } from '../../prisma/prisma.service';
export declare class CreateMessageDto {
    title: string;
    content: string;
    link?: string;
}
export declare class AdminMessagesController {
    private prisma;
    constructor(prisma: PrismaService);
    list(page?: string, pageSize?: string): Promise<{
        items: {
            id: string;
            content: string;
            createdAt: Date;
            title: string;
            link: string | null;
        }[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    create(dto: CreateMessageDto): Promise<{
        id: string;
        content: string;
        createdAt: Date;
        title: string;
        link: string | null;
    }>;
}
