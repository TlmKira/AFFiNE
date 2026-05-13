import { Body, Controller, Post } from '@nestjs/common';

import { BadRequest, Throttle } from '../../base';
import { ResearchCitationService } from './service';
import type { CitationResolveRequest } from './types';

@Throttle('authenticated', { limit: 30, ttl: 60_000 })
@Controller('/api/research/citation')
export class ResearchCitationController {
  constructor(private readonly service: ResearchCitationService) {}

  @Post('/resolve')
  async resolve(@Body() body: CitationResolveRequest) {
    const input = body.input?.trim();
    if (!input) {
      throw new BadRequest('Citation input is required.');
    }
    return await this.service.resolve(input);
  }
}
