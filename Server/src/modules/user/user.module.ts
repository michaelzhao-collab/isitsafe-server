import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [FamilyModule],
  controllers: [UserController],
})
export class UserModule {}
