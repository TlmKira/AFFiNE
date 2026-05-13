import { Module } from '@nestjs/common';

import { AuthModule } from '../auth';
import { ServerConfigModule } from '../config';
import { UserModule } from '../user';
import { CustomSetupController } from './controller';
import { SelfhostGuard } from './guard';
import { SetupMiddleware } from './setup';
import { StaticFilesResolver } from './static';
import { SelfhostStatusService } from './status';
import { SelfhostStatusController } from './status.controller';

@Module({
  imports: [AuthModule, UserModule, ServerConfigModule],
  providers: [
    SetupMiddleware,
    StaticFilesResolver,
    SelfhostGuard,
    SelfhostStatusService,
  ],
  controllers: [CustomSetupController, SelfhostStatusController],
})
export class SelfhostModule {}
