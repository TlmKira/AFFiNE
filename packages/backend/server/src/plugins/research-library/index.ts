import { Module } from '@nestjs/common';

import { PermissionModule } from '../../core/permission';
import { StorageModule } from '../../core/storage';
import { ResearchCitationModule } from '../research-citation';
import { ResearchLibraryController } from './controller';
import { ResearchLibraryCronJobs } from './cron';
import { ResearchLibraryService } from './service';

@Module({
  imports: [PermissionModule, ResearchCitationModule, StorageModule],
  providers: [ResearchLibraryService, ResearchLibraryCronJobs],
  controllers: [ResearchLibraryController],
})
export class ResearchLibraryModule {}
