import {
  BulletedListIcon,
  CheckBoxIcon,
  CodeBlockIcon,
  DividerIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
  NumberedListIcon,
  QuoteIcon,
  TextIcon,
} from '@blocksuite/affine-components/icons';
import type { NoteChildrenFlavour } from '@blocksuite/affine-shared/types';
import type { TemplateResult } from 'lit';

export const BUTTON_GROUP_LENGTH = 10;

export type NoteMenuItem = {
  icon: TemplateResult<1>;
  tooltip: string;
  childFlavour: NoteChildrenFlavour;
  childType: string | null;
};

const LIST_ITEMS = [
  {
    flavour: 'affine:list',
    type: 'bulleted',
    name: '项目符号列表',
    description: '一个简单的项目符号列表。',
    icon: BulletedListIcon,
    tooltip: '拖动/点击以插入项目符号列表',
  },
  {
    flavour: 'affine:list',
    type: 'numbered',
    name: '编号列表',
    description: '带编号的列表。',
    icon: NumberedListIcon,
    tooltip: '拖动/点击以插入编号列表',
  },
  {
    flavour: 'affine:list',
    type: 'todo',
    name: '待办列表',
    description: '使用待办列表跟踪任务。',
    icon: CheckBoxIcon,
    tooltip: '拖动/点击以插入待办列表',
  },
];

const TEXT_ITEMS = [
  {
    flavour: 'affine:paragraph',
    type: 'text',
    name: '文本',
    description: '使用普通文本开始输入。',
    icon: TextIcon,
    tooltip: '拖动/点击以插入文本块',
  },
  {
    flavour: 'affine:paragraph',
    type: 'h1',
    name: '标题 1',
    description: '最大字号的标题。',
    icon: Heading1Icon,
    tooltip: '拖动/点击以插入标题 1',
  },
  {
    flavour: 'affine:paragraph',
    type: 'h2',
    name: '标题 2',
    description: '第二级字号的标题。',
    icon: Heading2Icon,
    tooltip: '拖动/点击以插入标题 2',
  },
  {
    flavour: 'affine:paragraph',
    type: 'h3',
    name: '标题 3',
    description: '第三级字号的标题。',
    icon: Heading3Icon,
    tooltip: '拖动/点击以插入标题 3',
  },
  {
    flavour: 'affine:paragraph',
    type: 'h4',
    name: '标题 4',
    description: '第四级字号的标题。',
    icon: Heading4Icon,
    tooltip: '拖动/点击以插入标题 4',
  },
  {
    flavour: 'affine:paragraph',
    type: 'h5',
    name: '标题 5',
    description: '第五级字号的标题。',
    icon: Heading5Icon,
    tooltip: '拖动/点击以插入标题 5',
  },
  {
    flavour: 'affine:paragraph',
    type: 'h6',
    name: '标题 6',
    description: '第六级字号的标题。',
    icon: Heading6Icon,
    tooltip: '拖动/点击以插入标题 6',
  },
  {
    flavour: 'affine:code',
    type: 'code',
    name: '代码块',
    description: '记录一段代码片段。',
    icon: CodeBlockIcon,
    tooltip: '拖动/点击以插入代码块',
  },
  {
    flavour: 'affine:paragraph',
    type: 'quote',
    name: '引用',
    description: '记录一段引用。',
    icon: QuoteIcon,
    tooltip: '拖动/点击以插入引用',
  },
  {
    flavour: 'affine:divider',
    type: null,
    name: '分割线',
    description: '一条视觉分割线。',
    icon: DividerIcon,
    tooltip: '一条视觉分割线',
  },
];

// TODO: add image, bookmark, database blocks
export const NOTE_MENU_ITEMS = TEXT_ITEMS.concat(LIST_ITEMS)
  .filter(item => item.name !== 'Divider')
  .map(item => {
    return {
      icon: item.icon,
      tooltip:
        item.type !== 'text'
          ? item.tooltip.replace('拖动/点击以插入', '')
          : '文本',
      childFlavour: item.flavour as NoteChildrenFlavour,
      childType: item.type,
    } as NoteMenuItem;
  });
