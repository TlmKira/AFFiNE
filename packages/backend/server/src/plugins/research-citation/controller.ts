import { Body, Controller, Get, Post } from '@nestjs/common';

import { BadRequest, Throttle } from '../../base';
import { ResearchCitationService } from './service';
import type {
  CitationResolveRequest,
  CitationTranslateUrlRequest,
} from './types';
import { ResearchZoteroTranslatorService } from './zotero-translator';

@Throttle('authenticated', { limit: 30, ttl: 60_000 })
@Controller('/api/research/citation')
export class ResearchCitationController {
  constructor(
    private readonly service: ResearchCitationService,
    private readonly zoteroTranslators: ResearchZoteroTranslatorService
  ) {}

  @Post('/resolve')
  async resolve(@Body() body: CitationResolveRequest) {
    const input = body.input?.trim();
    if (!input) {
      throw new BadRequest('Citation input is required.');
    }
    return await this.service.resolve(input);
  }

  @Post('/translate-url')
  async translateUrl(@Body() body: CitationTranslateUrlRequest) {
    const url = body.url?.trim();
    if (!url) {
      throw new BadRequest('Translator URL is required.');
    }
    const result = await this.zoteroTranslators.translateUrl(url);
    if (!result) {
      return await this.service.resolve(url);
    }
    return result;
  }

  @Post('/parse')
  async parse(@Body() body: CitationResolveRequest) {
    const input = body.input?.trim();
    if (!input) {
      throw new BadRequest('Citation input is required.');
    }
    const items = await this.service.parseCitationFormats(input);
    if (!items.length) {
      return await this.service.resolve(input);
    }
    if (items.length === 1) {
      return {
        kind: 'single' as const,
        translator: 'Citation File',
        metadata: items[0],
      };
    }
    return {
      kind: 'multiple' as const,
      translator: 'Citation File',
      items: items.map((metadata, index) => ({
        id: metadata.doi ?? metadata.arxivId ?? metadata.url ?? `${index}`,
        title: metadata.title,
        url: metadata.url,
        metadata,
      })),
    };
  }

  @Get('/translators')
  async translators() {
    return await this.zoteroTranslators.listRuntimeTranslators();
  }
}
