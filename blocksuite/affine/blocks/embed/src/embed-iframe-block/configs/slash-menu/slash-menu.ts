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
  ],
};
