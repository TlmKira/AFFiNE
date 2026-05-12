import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '../../core/auth';
import { AccessController } from '../../core/permission';
import { NotebookRuntimeService } from './service';

@Controller()
export class NotebookRuntimeController {
  constructor(
    private readonly access: AccessController,
    private readonly runtime: NotebookRuntimeService
  ) {}

  @Get('/api/notebook/kernelspecs')
  async kernelspecs() {
    return await this.runtime.listKernelSpecs();
  }

  @Post('/api/workspaces/:workspaceId/notebooks/:blockId/sessions')
  async createSession(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('blockId') blockId: string,
    @Body('docId') docId: string
  ) {
    if (!docId) {
      throw new BadRequestException('docId is required.');
    }
    await this.access
      .user(user.id)
      .doc(workspaceId, docId)
      .assert('Doc.Update');
    return await this.runtime.createSession({
      blockId,
      docId,
      userId: user.id,
      workspaceId,
    });
  }

  @Delete('/api/workspaces/:workspaceId/notebooks/:blockId/sessions/:sessionId')
  async deleteSession(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string
  ) {
    await this.access
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Read');
    return await this.runtime.deleteSession(sessionId, user.id);
  }

  @Post(
    '/api/workspaces/:workspaceId/notebooks/:blockId/sessions/:sessionId/interrupt'
  )
  async interrupt(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string
  ) {
    await this.access
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Read');
    return await this.runtime.interrupt(sessionId, user.id);
  }

  @Post(
    '/api/workspaces/:workspaceId/notebooks/:blockId/sessions/:sessionId/restart'
  )
  async restart(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string
  ) {
    await this.access
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Read');
    return await this.runtime.restart(sessionId, user.id);
  }

  @Post(
    '/api/workspaces/:workspaceId/notebooks/:blockId/sessions/:sessionId/execute'
  )
  async execute(
    @CurrentUser() user: CurrentUser,
    @Param('workspaceId') workspaceId: string,
    @Param('sessionId') sessionId: string,
    @Body('code') code = ''
  ) {
    await this.access
      .user(user.id)
      .workspace(workspaceId)
      .assert('Workspace.Read');
    return await this.runtime.execute(sessionId, user.id, code);
  }
}
