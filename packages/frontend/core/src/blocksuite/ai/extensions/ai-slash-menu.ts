import { AIStarIcon } from '@blocksuite/affine/components/icons';
import { DocModeProvider } from '@blocksuite/affine/shared/services';
import {
  type SlashMenuActionItem,
  SlashMenuConfigExtension,
  type SlashMenuContext,
  type SlashMenuItem,
  type SlashMenuSubMenu,
} from '@blocksuite/affine/widgets/slash-menu';
import { MoreHorizontalIcon } from '@blocksuite/icons/lit';
import { html } from 'lit';

import { pageAIGroups } from '../_common/config';
import { handleInlineAskAIAction } from '../actions/doc-handler';
import type { AIItemConfig } from '../components/ai-item/types';
import {
  AFFINE_AI_PANEL_WIDGET,
  type AffineAIPanelWidget,
} from '../widgets/ai-panel/ai-panel';

export function AiSlashMenuConfigExtension() {
  const AIItems = pageAIGroups.flatMap(group => group.items);

  const iconWrapper = (icon: AIItemConfig['icon']) => {
    return html`<div style="color: var(--affine-primary-color)">
      ${typeof icon === 'function' ? html`${icon()}` : icon}
    </div>`;
  };

  const showWhenWrapper =
    (item?: AIItemConfig) =>
    ({ std }: SlashMenuContext) => {
      const root = std.host.store.root;
      if (!root) return false;
      const affineAIPanelWidget = std.view.getWidget(
        AFFINE_AI_PANEL_WIDGET,
        root.id
      );
      if (affineAIPanelWidget === null) return false;

      const chain = std.host.command.chain();
      const docModeService = std.get(DocModeProvider);
      const editorMode = docModeService.getPrimaryMode(std.host.store.id);

      return item?.showWhen?.(chain, editorMode, std.host) ?? true;
    };

  const actionItemWrapper = (item: AIItemConfig): SlashMenuActionItem => ({
    ...basicItemConfig(item),
    action: ({ std }: SlashMenuContext) => {
      item?.handler?.(std.host);
    },
  });

  const subMenuWrapper = (item: AIItemConfig): SlashMenuSubMenu => {
    return {
      ...basicItemConfig(item),
      subMenu: (item.subItem ?? []).map<SlashMenuActionItem>(
        ({ type, handler }) => ({
          name: type,
          action: ({ std }) => handler?.(std.host),
        })
      ),
    };
  };

  const basicItemConfig = (item: AIItemConfig) => {
    return {
      name: item.name,
      icon: iconWrapper(item.icon),
      searchAlias: ['ai'],
      when: showWhenWrapper(item),
    };
  };

  let index = 0;
  const AIMenuItems: SlashMenuItem[] = [
    {
      name: '\u95ee\u95ee AI',
      icon: AIStarIcon,
      when: showWhenWrapper(),
      action: ({ std }) => {
        const root = std.host.store.root;
        if (!root) return;
        const affineAIPanelWidget = std.view.getWidget(
          AFFINE_AI_PANEL_WIDGET,
          root.id
        ) as AffineAIPanelWidget;
        handleInlineAskAIAction(affineAIPanelWidget.host);
      },
    },
    ...AIItems.filter(({ name }) =>
      ['\u4fee\u6b63\u62fc\u5199', '\u4fee\u6b63\u8bed\u6cd5'].includes(name)
    ).map<SlashMenuActionItem>(item => ({
      ...actionItemWrapper(item),
      name: `${item.name}\uff08\u57fa\u4e8e\u4e0a\u6587\uff09`,
      group: `1_AI\u52a9\u624b@${index++}`,
    })),

    ...AIItems.filter(({ name }) =>
      ['\u603b\u7ed3\u8981\u70b9', '\u7ee7\u7eed\u5199\u4f5c'].includes(name)
    ).map<SlashMenuActionItem>(item => ({
      ...actionItemWrapper(item),
      group: `1_AI\u52a9\u624b@${index++}`,
    })),

    {
      name: '\u5bf9\u4e0a\u6587\u6267\u884c\u64cd\u4f5c',
      icon: iconWrapper(MoreHorizontalIcon({ width: '24px', height: '24px' })),
      group: `1_AI\u52a9\u624b@${index++}`,
      subMenu: [
        ...AIItems.filter(({ name }) =>
          ['\u7ffb\u8bd1\u4e3a', '\u8bed\u6c14\u8c03\u6574\u4e3a'].includes(
            name
          )
        ).map(subMenuWrapper),

        ...AIItems.filter(({ name }) =>
          [
            '\u4f18\u5316\u5199\u4f5c',
            '\u6269\u5199\u5185\u5bb9',
            '\u7cbe\u7b80\u5185\u5bb9',
            '\u751f\u6210\u5927\u7eb2',
            '\u63d0\u53d6\u884c\u52a8\u9879',
          ].includes(name)
        ).map(actionItemWrapper),
      ],
    },
  ];

  return SlashMenuConfigExtension('ai', {
    items: AIMenuItems,
  });
}
