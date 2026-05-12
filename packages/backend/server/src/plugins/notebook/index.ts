import './config';

import { Module } from '@nestjs/common';

import { AuthModule } from '../../core/auth';
import { PermissionModule } from '../../core/permission';
import { NotebookRuntimeController } from './controller';
import { NotebookRuntimeService } from './service';

@Module({
  imports: [AuthModule, PermissionModule],
  providers: [NotebookRuntimeService],
  controllers: [NotebookRuntimeController],
})
export class NotebookRuntimeModule {}
