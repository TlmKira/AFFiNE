import './config';

import { Module } from '@nestjs/common';

import { ResearchCitationController } from './controller';
import { ResearchCitationService } from './service';
import { ResearchZoteroRuntimeService } from './zotero-runtime';
import { ResearchZoteroTranslatorService } from './zotero-translator';

@Module({
  providers: [
    ResearchCitationService,
    ResearchZoteroRuntimeService,
    ResearchZoteroTranslatorService,
  ],
  controllers: [ResearchCitationController],
  exports: [
    ResearchCitationService,
    ResearchZoteroRuntimeService,
    ResearchZoteroTranslatorService,
  ],
})
export class ResearchCitationModule {}
