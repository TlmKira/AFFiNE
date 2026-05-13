import './config';

import { Module } from '@nestjs/common';

import { ResearchCitationController } from './controller';
import { ResearchCitationService } from './service';

@Module({
  providers: [ResearchCitationService],
  controllers: [ResearchCitationController],
})
export class ResearchCitationModule {}
