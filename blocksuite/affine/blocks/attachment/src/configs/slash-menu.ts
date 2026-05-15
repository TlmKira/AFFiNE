import { openSingleFileWith } from '@blocksuite/affine-shared/utils';
import { type SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { ExportToPdfIcon, FileIcon } from '@blocksuite/icons/lit';

import { addSiblingAttachmentBlocks } from '../utils';
import { AttachmentTooltip, PDFTooltip } from './tooltips';

export const attachmentSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: '附件',
      description: '向文档添加文件附件。',
      icon: FileIcon(),
      tooltip: {
        figure: AttachmentTooltip,
        caption: '附件',
      },
      searchAlias: ['attachment', 'file'],
      group: '4_Content & Media@3',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:attachment'),
      action: ({ std, model }) => {
        (async () => {
          const file = await openSingleFileWith();
          if (!file) return;

          await addSiblingAttachmentBlocks(std, [file], model);
          if (model.text?.length === 0) {
            std.store.deleteBlock(model);
          }
        })().catch(console.error);
      },
    },
    {
      name: 'PDF',
      description: '向文档上传 PDF 文件。',
      icon: ExportToPdfIcon(),
      tooltip: {
        figure: PDFTooltip,
        caption: 'PDF',
      },
      group: '4_Content & Media@4',
      when: ({ model }) =>
        model.store.schema.flavourSchemaMap.has('affine:attachment'),
      action: ({ std, model }) => {
        (async () => {
          const file = await openSingleFileWith();
          if (!file) return;

          await addSiblingAttachmentBlocks(std, [file], model);
          if (model.text?.length === 0) {
            std.store.deleteBlock(model);
          }
        })().catch(console.error);
      },
    },
  ],
};
