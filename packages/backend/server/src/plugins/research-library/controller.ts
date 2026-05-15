import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { BadRequest, Throttle } from '../../base';
import { CurrentUser } from '../../core/auth';
import { ResearchLibraryService } from './service';
import type { CreateResearchFeedInput, UpdateResearchFeedInput } from './types';

@Throttle('authenticated', { limit: 60, ttl: 60_000 })
@Controller('/api/research')
export class ResearchLibraryController {
  constructor(private readonly library: ResearchLibraryService) {}

  @Post('/papers/recognize-pdf')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    })
  )
  async recognizePdf(
    @CurrentUser() user: CurrentUser,
    @Query('workspaceId') workspaceId: string,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype?: string;
      originalname?: string;
      size?: number;
    }
  ) {
    if (!workspaceId) {
      throw new BadRequest('workspaceId 不能为空。');
    }
    if (!file) {
      throw new BadRequest('请上传 PDF 文件。');
    }
    return await this.library.recognizePdf(user.id, workspaceId, file);
  }

  @Get('/feeds')
  async listFeeds(
    @CurrentUser() user: CurrentUser,
    @Query('workspaceId') workspaceId: string
  ) {
    if (!workspaceId) {
      throw new BadRequest('workspaceId 不能为空。');
    }
    return await this.library.listFeeds(user.id, workspaceId);
  }

  @Post('/feeds')
  @HttpCode(HttpStatus.OK)
  async createFeed(
    @CurrentUser() user: CurrentUser,
    @Body() input: CreateResearchFeedInput
  ) {
    if (!input.workspaceId || !input.url) {
      throw new BadRequest('workspaceId 和 url 不能为空。');
    }
    return await this.library.createFeed(user.id, input);
  }

  @Patch('/feeds/:id')
  async updateFeed(
    @CurrentUser() user: CurrentUser,
    @Param('id') id: string,
    @Body() input: UpdateResearchFeedInput
  ) {
    return await this.library.updateFeed(user.id, id, input);
  }

  @Delete('/feeds/:id')
  async deleteFeed(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return await this.library.deleteFeed(user.id, id);
  }

  @Post('/feeds/:id/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshFeed(@CurrentUser() user: CurrentUser, @Param('id') id: string) {
    return await this.library.refreshFeed(user.id, id);
  }

  @Get('/feed-items')
  async listFeedItems(
    @CurrentUser() user: CurrentUser,
    @Query('workspaceId') workspaceId: string
  ) {
    if (!workspaceId) {
      throw new BadRequest('workspaceId 不能为空。');
    }
    return await this.library.listFeedItems(user.id, workspaceId);
  }
}
