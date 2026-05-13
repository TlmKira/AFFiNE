import { Controller, Get } from '@nestjs/common';

import { UseNamedGuard } from '../../base';
import { Admin } from '../common';
import { SelfhostStatusService } from './status';

@UseNamedGuard('selfhost')
@Admin()
@Controller('/api/self-host')
export class SelfhostStatusController {
  constructor(private readonly status: SelfhostStatusService) {}

  @Get('/status')
  async getStatus() {
    return this.status.getStatus();
  }
}
