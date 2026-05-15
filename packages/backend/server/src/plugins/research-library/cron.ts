import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ResearchLibraryService } from './service';

@Injectable()
export class ResearchLibraryCronJobs {
  constructor(private readonly library: ResearchLibraryService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshFeeds() {
    await this.library.refreshDueFeeds();
  }
}
