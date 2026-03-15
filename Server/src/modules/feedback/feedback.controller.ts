import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, MaxLength } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

export class SubmitFeedbackDto {
  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
}

/** 客户端：提交意见反馈（文案+可选一张图，图需先通过 /api/upload/file 上传） */
@Controller('feedback')
@UseGuards(OptionalJwtAuthGuard)
export class FeedbackController {
  constructor(private prisma: PrismaService) {}

  @Post()
  async submit(
    @Body() dto: SubmitFeedbackDto,
    @CurrentUser('sub') userId?: string,
  ) {
    await this.prisma.userFeedback.create({
      data: {
        userId: userId ?? null,
        content: dto.content.trim(),
        imageUrl: dto.imageUrl?.trim() || null,
      },
    });
    return { ok: true };
  }
}
