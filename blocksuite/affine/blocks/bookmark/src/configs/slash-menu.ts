import { DefaultTool } from '@blocksuite/affine-block-surface';
import { toggleEmbedCardCreateModal } from '@blocksuite/affine-components/embed-card-modal';
import { BookmarkBlockSchema } from '@blocksuite/affine-model';
import { NotificationProvider } from '@blocksuite/affine-shared/services';
import {
  type SlashMenuConfig,
  SlashMenuConfigIdentifier,
} from '@blocksuite/affine-widget-slash-menu';
import { LinkIcon } from '@blocksuite/icons/lit';
import { GfxControllerIdentifier } from '@blocksuite/std/gfx';
import type { BlockModel, ExtensionType } from '@blocksuite/store';

import { createResolvedResearchCitationBookmarkProps } from './research-citation';
import { LinkTooltip } from './tooltips';

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
      action: async ({ std, model }) => {
        const notification = std.getOptional(NotificationProvider);
        const input = await notification?.prompt({
          title: '论文引用',
          message: '输入 DOI、arXiv、论文 URL、BibTeX 或论文标题。',
          placeholder: '10.1145/... / arXiv:2401.00001 / @article{...}',
          confirmText: '插入引用',
          cancelText: '取消',
        });

        if (!input?.trim()) {
          return;
        }

        const parentModel = std.host.store.getParent(model);
        if (!parentModel) {
          return;
        }

        notification?.toast('正在补全论文信息...');
        const { props, resolved } =
          await createResolvedResearchCitationBookmarkProps(
            input,
            getNextFootnoteIdentifier(model)
          );
        const index = parentModel.children.indexOf(model) + 1;
        std.host.store.addBlock('affine:bookmark', props, parentModel, index);
        notification?.toast(
          resolved ? '已补全论文信息' : '未能可靠补全，已插入可编辑引用卡片'
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
