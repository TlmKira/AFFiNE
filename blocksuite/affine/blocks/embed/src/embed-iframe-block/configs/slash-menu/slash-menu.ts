import { getSelectedModelsCommand } from '@blocksuite/affine-shared/commands';
import { DefaultTool } from '@blocksuite/affine-block-surface';
import { toggleEmbedCardCreateModal } from '@blocksuite/affine-components/embed-card-modal';
import type { SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { EmbedIcon } from '@blocksuite/icons/lit';
import { GfxControllerIdentifier } from '@blocksuite/std/gfx';

import { insertEmptyEmbedIframeCommand } from '../../commands/insert-empty-embed-iframe';
import { createJupyterLiteBlockProps } from '../providers/jupyterlite';
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
      action: ({ std, model }) => {
        const { host } = std;
        const parentModel = host.store.getParent(model);
        if (!parentModel) {
          return;
        }
        const index = parentModel.children.indexOf(model) + 1;
        toggleEmbedCardCreateModal(
          host,
          'Bilibili 视频',
          '粘贴 BV、av 或 player.bilibili.com 视频链接。',
          { mode: 'page', parentModel, index },
          ({ mode }) => {
            if (mode === 'edgeless') {
              const gfx = std.get(GfxControllerIdentifier);
              gfx.tool.setTool(DefaultTool);
            }
          }
        )
          .then(() => {
            if (model.text?.length === 0) {
              model.store.deleteBlock(model);
            }
          })
          .catch(console.error);
      },
    },
    {
      name: 'Jupyter Notebook',
      description: '插入一个浏览器本地运行的 JupyterLite Notebook。',
      icon: EmbedIcon(),
      tooltip: {
        figure: EmbedIframeTooltip,
        caption: 'Jupyter Notebook',
      },
      group: '4_Content & Media@8',
      when: ({ model }) => {
        return model.store.schema.flavourSchemaMap.has('affine:embed-iframe');
      },
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(({ selectedModels }) => {
            if (!selectedModels?.length) {
              return;
            }
            const targetModel = selectedModels[selectedModels.length - 1];
            const result = std.store.addSiblingBlocks(
              targetModel,
              [
                {
                  flavour: 'affine:embed-iframe',
                  ...createJupyterLiteBlockProps(),
                },
              ],
              'after'
            );
            if (targetModel.text?.length === 0 && result.length) {
              std.store.deleteBlock(targetModel);
            }
          })
          .run();
      },
    },
  ],
};
