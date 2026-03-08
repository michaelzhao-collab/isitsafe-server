import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MessagesController],
})
export class MessagesModule {}
