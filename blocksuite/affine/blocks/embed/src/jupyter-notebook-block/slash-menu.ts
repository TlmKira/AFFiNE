import { getSelectedModelsCommand } from '@blocksuite/affine-shared/commands';
import type { SlashMenuConfig } from '@blocksuite/affine-widget-slash-menu';
import { EmbedIcon } from '@blocksuite/icons/lit';

export const jupyterNotebookSlashMenuConfig: SlashMenuConfig = {
  items: [
    {
      name: 'Jupyter Notebook',
      description: '插入一个 Colab 风格的自部署 Python Notebook。',
      icon: EmbedIcon(),
      group: '4_Content & Media@8',
      when: ({ model }) => {
        return model.store.schema.flavourSchemaMap.has(
          'affine:jupyter-notebook'
        );
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
              [{ flavour: 'affine:jupyter-notebook' }],
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
