import { getSelectedModelsCommand } from '@blocksuite/affine-shared/commands';
import type { SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { EmbedIcon } from '@blocksuite/icons/lit';

import { insertEmptyEmbedIframeCommand } from '../../commands/insert-empty-embed-iframe';
import { EmbedIframeTooltip } from './tooltip';

export const embedIframeSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: '嵌入',
      description: '用于 Google Drive 等外部内容。',
      icon: EmbedIcon(),
      tooltip: {
        figure: EmbedIframeTooltip,
        caption: '嵌入',
      },
      group: '4_Content & Media@5',
      when: ({ model }) => {
        return model.store.schema.flavourSchemaMap.has('affine:embed-iframe');
      },
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertEmptyEmbedIframeCommand, {
            place: 'after',
            removeEmptyLine: true,
            linkInputPopupOptions: {
              telemetrySegment: 'slash menu',
            },
          })
          .run();
      },
    },
    {
      name: 'Bilibili 视频',
      description: '嵌入一个 Bilibili 视频。',
      icon: EmbedIcon(),
      tooltip: {
        figure: EmbedIframeTooltip,
        caption: 'Bilibili 视频',
      },
      group: '4_Content & Media@7',
      when: ({ model }) => {
        return model.store.schema.flavourSchemaMap.has('affine:embed-iframe');
      },
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertEmptyEmbedIframeCommand, {
            place: 'after',
            removeEmptyLine: true,
            linkInputPopupOptions: {
              telemetrySegment: 'slash menu',
              title: 'Bilibili 视频',
              description: '粘贴 BV、av 或 player.bilibili.com 视频链接。',
              placeholder:
                'BV1... / av123456 / https://www.bilibili.com/video/...',
            },
          })
          .run();
      },
    },
  ],
};
