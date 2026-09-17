import { Module } from '@nestjs/common';
import { UsersMessageController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersMessageController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
