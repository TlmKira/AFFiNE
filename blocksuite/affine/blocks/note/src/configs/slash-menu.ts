import {
  formatBlockCommand,
  type TextFormatConfig,
  textFormatConfigs,
} from '@blocksuite/affine-inline-preset';
import {
  type TextAlignConfig,
  textAlignConfigs,
  type TextConversionConfig,
  textConversionConfigs,
} from '@blocksuite/affine-rich-text';
import {
  getSelectedModelsCommand,
  getTextSelectionCommand,
} from '@blocksuite/affine-shared/commands';
import { isInsideBlockByFlavour } from '@blocksuite/affine-shared/utils';
import {
  type SlashMenuActionItem,
  type SlashMenuConfig,
  SlashMenuConfigExtension,
  type SlashMenuItem,
} from '@blocksuite/affine-widget-slash-menu';
import { HeadingsIcon } from '@blocksuite/icons/lit';
import { BlockSelection } from '@blocksuite/std';

import { updateBlockAlign, updateBlockType } from '../commands';
import { tooltips } from './tooltips';

let basicIndex = 0;

const slashMenuNameLabels: Record<string, string> = {
  'Align center': '居中对齐',
  'Align left': '左对齐',
  'Align right': '右对齐',
  Bold: '加粗',
  'Bulleted List': '项目符号列表',
  'Code Block': '代码块',
  Divider: '分割线',
  'Heading 1': '标题 1',
  'Heading 2': '标题 2',
  'Heading 3': '标题 3',
  'Heading 4': '标题 4',
  'Heading 5': '标题 5',
  'Heading 6': '标题 6',
  Italic: '斜体',
  'Numbered List': '编号列表',
  'Other Headings': '更多标题',
  Quote: '引用',
  Strikethrough: '删除线',
  Text: '文本',
  'To-do List': '待办列表',
  Underline: '下划线',
};

const slashMenuDescriptionLabels: Record<string, string> = {
  'Add a blockquote for emphasis.': '添加引用块以突出内容。',
  'Add tasks to a to-do list.': '添加待办事项列表。',
  'Code snippet with formatting.': '插入带格式的代码片段。',
  'Create a bulleted list.': '创建项目符号列表。',
  'Create a numbered list.': '创建编号列表。',
  'Headings in the 2nd font size.': '使用第二级标题字号。',
  'Headings in the 3rd font size.': '使用第三级标题字号。',
  'Headings in the 4th font size.': '使用第四级标题字号。',
  'Headings in the 5th font size.': '使用第五级标题字号。',
  'Headings in the 6th font size.': '使用第六级标题字号。',
  'Headings in the largest font.': '使用最大标题字号。',
  'Start typing with plain text.': '开始输入普通文本。',
  'Visually separate content.': '用分割线分隔内容。',
};

const getSlashMenuName = (name: string) => slashMenuNameLabels[name] ?? name;
const getSlashMenuDescription = (description?: string) =>
  description ? (slashMenuDescriptionLabels[description] ?? description) : '';

const noteSlashMenuConfig: SlashMenuConfig = {
  items: [
    ...textConversionConfigs
      .filter(i => i.type && ['h1', 'h2', 'h3', 'text'].includes(i.type))
      .map(config => createConversionItem(config, `0_Basic@${basicIndex++}`)),
    {
      name: getSlashMenuName('Other Headings'),
      icon: HeadingsIcon(),
      group: `0_Basic@${basicIndex++}`,
      subMenu: textConversionConfigs
        .filter(i => i.type && ['h4', 'h5', 'h6'].includes(i.type))
        .map(config => createConversionItem(config)),
    },
    ...textConversionConfigs
      .filter(i => i.flavour === 'affine:code')
      .map(config => createConversionItem(config, `0_Basic@${basicIndex++}`)),

    ...textConversionConfigs
      .filter(i => i.type && ['divider', 'quote'].includes(i.type))
      .map(
        config =>
          ({
            ...createConversionItem(config, `0_Basic@${basicIndex++}`),
            when: ({ model }) =>
              model.store.schema.flavourSchemaMap.has(config.flavour) &&
              !isInsideBlockByFlavour(
                model.store,
                model,
                'affine:edgeless-text'
              ),
          }) satisfies SlashMenuActionItem
      ),

    ...textConversionConfigs
      .filter(i => i.flavour === 'affine:list')
      .map((config, index) =>
        createConversionItem(config, `1_List@${index++}`)
      ),

    ...textAlignConfigs.map((config, index) =>
      createAlignItem(config, `2_Align@${index++}`)
    ),

    ...textFormatConfigs
      .filter(i => !['Code', 'Link'].includes(i.name))
      .map((config, index) =>
        createTextFormatItem(config, `2_Style@${index++}`)
      ),
  ],
};

function createConversionItem(
  config: TextConversionConfig,
  group?: SlashMenuItem['group']
): SlashMenuActionItem {
  const { name, description, icon, flavour, type, searchAlias = [] } = config;
  return {
    name: getSlashMenuName(name),
    group,
    description: getSlashMenuDescription(description),
    icon,
    searchAlias,
    tooltip: tooltips[name],
    when: ({ model }) => model.store.schema.flavourSchemaMap.has(flavour),
    action: ({ std }) => {
      std.command.exec(updateBlockType, {
        flavour,
        props: { type },
      });
    },
  };
}

function createAlignItem(
  config: TextAlignConfig,
  group?: SlashMenuItem['group']
): SlashMenuActionItem {
  const { textAlign, name, icon } = config;
  return {
    name: getSlashMenuName(name),
    group,
    icon,
    action: ({ std }) => {
      std.command
        .chain()
        .pipe(getTextSelectionCommand)
        .pipe(getSelectedModelsCommand, { types: ['text'] })
        .pipe(updateBlockAlign, { textAlign })
        .run();
    },
  };
}

function createTextFormatItem(
  config: TextFormatConfig,
  group?: SlashMenuItem['group']
): SlashMenuActionItem {
  const { name, icon, id, action } = config;
  return {
    name: getSlashMenuName(name),
    icon,
    group,
    tooltip: tooltips[name],
    action: ({ std, model }) => {
      const { host } = std;

      if (model.text?.length !== 0) {
        std.command.exec(formatBlockCommand, {
          blockSelections: [
            std.selection.create(BlockSelection, {
              blockId: model.id,
            }),
          ],
          styles: { [id]: true },
        });
      } else {
        // like format bar when the line is empty
        action(host);
      }
    },
  };
}

export const NoteSlashMenuConfigExtension = SlashMenuConfigExtension(
  'affine:note',
  noteSlashMenuConfig
);
