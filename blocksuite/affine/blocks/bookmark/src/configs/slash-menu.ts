import { DefaultTool } from '@blocksuite/affine-block-surface';
import { toggleEmbedCardCreateModal } from '@blocksuite/affine-components/embed-card-modal';
import { BookmarkBlockSchema } from '@blocksuite/affine-model';
import {
  type SlashMenuConfig,
  SlashMenuConfigIdentifier,
} from '@blocksuite/affine-widget-slash-menu';
import { LinkIcon } from '@blocksuite/icons/lit';
import { GfxControllerIdentifier } from '@blocksuite/std/gfx';
import type { BlockModel, ExtensionType } from '@blocksuite/store';

import { LinkTooltip } from './tooltips';
import { createResearchCitationBookmarkProps } from './research-citation';

function getNextFootnoteIdentifier(model: BlockModel) {
  const parent = model.store.getParent(model);
  const citationCount =
    parent?.children.filter(
      child =>
        child.flavour === 'affine:bookmark' &&
        'footnoteIdentifier' in child.props &&
        !!child.props.footnoteIdentifier
    ).length ?? 0;
  return String(citationCount + 1);
}

const bookmarkSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: '链接',
      description: '添加一个链接卡片。',
      icon: LinkIcon(),
      tooltip: {
        figure: LinkTooltip,
        caption: '链接',
      },
      group: '4_Content & Media@2',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:bookmark'),
      action: ({ std, model }) => {
        const { host } = std;
        const parentModel = host.store.getParent(model);
        if (!parentModel) {
          return;
        }
        const index = parentModel.children.indexOf(model) + 1;
        toggleEmbedCardCreateModal(
          host,
          '链接',
          '添加的链接将显示为卡片视图。',
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
      name: '论文引用',
      description: '从 DOI、arXiv、URL、BibTeX 或标题创建论文引用卡片。',
      icon: LinkIcon(),
      tooltip: {
        figure: LinkTooltip,
        caption: '论文引用',
      },
      group: '4_Content & Media@3',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:bookmark'),
      action: ({ std, model }) => {
        const input = window.prompt(
          '请输入 DOI、arXiv、论文 URL、BibTeX 或论文标题'
        );
        if (!input?.trim()) {
          return;
        }

        const parentModel = std.host.store.getParent(model);
        if (!parentModel) {
          return;
        }

        const index = parentModel.children.indexOf(model) + 1;
        std.host.store.addBlock(
          'affine:bookmark',
          createResearchCitationBookmarkProps(
            input,
            getNextFootnoteIdentifier(model)
          ),
          parentModel,
          index
        );

        if (model.text?.length === 0) {
          model.store.deleteBlock(model);
        }
      },
    },
  ],
};

export const BookmarkSlashMenuConfigIdentifier = SlashMenuConfigIdentifier(
  BookmarkBlockSchema.model.flavour
);

export const BookmarkSlashMenuConfigExtension: ExtensionType = {
  setup: di => {
    di.addImpl(BookmarkSlashMenuConfigIdentifier, bookmarkSlashMenuConfig);
  },
};
