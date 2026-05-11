import { reassociateConnectorsCommand } from '@blocksuite/affine-block-surface';
import { toast } from '@blocksuite/affine-components/toast';
import {
  BookmarkStyles,
  EmbedIframeBlockModel,
} from '@blocksuite/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@blocksuite/affine-shared/consts';
import {
  ActionPlacement,
  type ToolbarAction,
  type ToolbarActionGroup,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@blocksuite/affine-shared/services';
import { getBlockProps } from '@blocksuite/affine-shared/utils';
import { Bound } from '@blocksuite/global/gfx';
import {
  CaptionIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  LinkedPageIcon,
  OpenInNewIcon,
  ResetIcon,
} from '@blocksuite/icons/lit';
import { BlockFlavourIdentifier, BlockSelection } from '@blocksuite/std';
import {
  type ExtensionType,
  Slice,
  Text,
  toDraftModel,
} from '@blocksuite/store';
import { computed, signal } from '@preact/signals-core';
import { html } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import * as Y from 'yjs';

import {
  convertSelectedBlocksToLinkedDoc,
  getTitleFromSelectedModels,
  notifyDocCreated,
  promptDocTitle,
} from '../../common/render-linked-doc';
import { EmbedIframeBlockComponent } from '../embed-iframe-block';
import {
  createDefaultNotebookJson,
  isJupyterLiteUrl,
} from './providers/jupyterlite';

const trackBaseProps = {
  category: 'embed iframe block',
};

const showWhenUrlExists = (ctx: ToolbarContext) => {
  const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
  if (!model) return false;

  return !!model.props.url;
};

const showWhenJupyterLite = (ctx: ToolbarContext) => {
  const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
  return !!model && isJupyterLiteUrl(model.props.url);
};

type NotebookIframeProps = EmbedIframeBlockModel['props'] & {
  lastSyncedAt?: number;
  notebookJson?: string;
  recentOutputsSummary?: string | null;
  sourceMode?: 'ipynb' | 'blocks';
  syncStatus?: 'idle' | 'synced' | 'exported' | 'error';
};

function getNotebookProps(model: EmbedIframeBlockModel) {
  return model.props as NotebookIframeProps;
}

const JUPYTERLITE_STORAGE_DB = 'JupyterLite Storage - /jupyterlite/';
const JUPYTERLITE_NOTEBOOK_PATH = 'affine-notebook.ipynb';

function createText(value: string) {
  const yText = new Y.Text();
  yText.insert(0, value);
  return new Text(yText);
}

function notebookFromJsonString(notebookJson: string) {
  try {
    return JSON.parse(notebookJson);
  } catch {
    return JSON.parse(createDefaultNotebookJson());
  }
}

function idbRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readJupyterLiteNotebookJson() {
  if (typeof indexedDB === 'undefined') return null;

  const database = await idbRequest(indexedDB.open(JUPYTERLITE_STORAGE_DB));
  try {
    for (const storeName of ['files', 'checkpoints']) {
      if (!database.objectStoreNames.contains(storeName)) continue;

      const tx = database.transaction(storeName, 'readonly');
      const value = await idbRequest(
        tx.objectStore(storeName).get(JUPYTERLITE_NOTEBOOK_PATH)
      );
      const content = Array.isArray(value)
        ? value[0]?.content
        : (value as { content?: unknown } | undefined)?.content;
      if (content) {
        return JSON.stringify(content, null, 2);
      }
    }
  } finally {
    database.close();
  }

  return null;
}

async function getCurrentNotebookJson(model: EmbedIframeBlockModel) {
  try {
    const notebookJson = await readJupyterLiteNotebookJson();
    if (notebookJson) {
      return notebookJson;
    }
  } catch (error) {
    console.warn('Failed to read JupyterLite notebook snapshot.', error);
  }

  return getNotebookProps(model).notebookJson || createDefaultNotebookJson();
}

function sourceToString(source: unknown) {
  if (Array.isArray(source)) {
    return source.join('');
  }
  return typeof source === 'string' ? source : '';
}

function downloadNotebook(model: EmbedIframeBlockModel, notebookJson: string) {
  const title = (model.props.title || 'affine-notebook')
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim();
  const blob = new Blob([notebookJson], {
    type: 'application/x-ipynb+json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title || 'affine-notebook'}.ipynb`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function syncNotebookToBlocks(
  ctx: ToolbarContext,
  model: EmbedIframeBlockModel
) {
  const parent = model.parent;
  if (!parent) return false;

  const notebookJson = await getCurrentNotebookJson(model);
  const notebook = notebookFromJsonString(notebookJson);
  const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
  let index = parent.children.indexOf(model) + 1;

  for (const cell of cells) {
    const source = sourceToString(cell.source);
    if (!source.trim()) {
      continue;
    }

    if (cell.cell_type === 'code') {
      ctx.store.addBlock(
        'affine:code',
        {
          language: 'python',
          text: createText(source),
        },
        parent,
        index++
      );
    } else {
      ctx.store.addBlock(
        'affine:paragraph',
        {
          text: createText(source),
        },
        parent,
        index++
      );
    }

    const hasImageOutput = Array.isArray(cell.outputs)
      ? cell.outputs.some(
          (output: { data?: Record<string, unknown> }) =>
            output.data?.['image/png'] || output.data?.['image/jpeg']
        )
      : false;
    if (hasImageOutput) {
      ctx.store.addBlock(
        'affine:paragraph',
        {
          text: createText('[Notebook 图片输出已保留在 .ipynb 快照中]'),
        },
        parent,
        index++
      );
    }
  }

  ctx.store.updateBlock(model, {
    lastSyncedAt: Date.now(),
    notebookJson,
    sourceMode: 'ipynb',
    syncStatus: 'synced',
  });
  return true;
}

function notebookFromFollowingBlocks(model: EmbedIframeBlockModel) {
  const parent = model.parent;
  const cells = [];
  if (parent) {
    const start = parent.children.indexOf(model) + 1;
    for (const child of parent.children.slice(start)) {
      if (child.flavour === 'affine:embed-iframe') {
        break;
      }
      if (!('text' in child.props)) {
        continue;
      }
      const rawText = child.props.text;
      const source =
        typeof rawText === 'string' ? rawText : (rawText?.toString?.() ?? '');
      if (!source.trim()) {
        continue;
      }
      cells.push({
        cell_type: child.flavour === 'affine:code' ? 'code' : 'markdown',
        execution_count: null,
        metadata: {},
        outputs: [],
        source,
      });
    }
  }

  if (!cells.length) {
    return createDefaultNotebookJson();
  }

  const base = notebookFromJsonString(
    getNotebookProps(model).notebookJson || createDefaultNotebookJson()
  );
  return JSON.stringify(
    {
      ...base,
      cells,
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    2
  );
}

const openLinkAction = (id: string): ToolbarAction => {
  return {
    id,
    when: showWhenUrlExists,
    tooltip: 'Original',
    icon: OpenInNewIcon(),
    run(ctx) {
      const component = ctx.getCurrentBlockByType(EmbedIframeBlockComponent);
      component?.open();

      ctx.track('OpenLink', {
        ...trackBaseProps,
        control: 'open original link',
      });
    },
  };
};

const captionAction = (id: string): ToolbarAction => {
  return {
    id,
    when: showWhenUrlExists,
    tooltip: 'Caption',
    icon: CaptionIcon(),
    run(ctx) {
      const component = ctx.getCurrentBlockByType(EmbedIframeBlockComponent);
      component?.captionEditor?.show();

      ctx.track('OpenedCaptionEditor', {
        ...trackBaseProps,
        control: 'add caption',
      });
    },
  };
};

export const builtinToolbarConfig = {
  actions: [
    openLinkAction('a.open-link'),
    {
      id: 'c.conversions',
      when: showWhenUrlExists,
      actions: [
        {
          id: 'inline',
          label: 'Inline view',
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
            if (!model) return;

            const { title, caption, url } = model.props;
            if (!url) return;

            const { parent } = model;
            const index = parent?.children.indexOf(model);

            const yText = new Y.Text();
            const insert = title || caption || url;
            yText.insert(0, insert);
            yText.format(0, insert.length, { link: url });

            const text = new Text(yText);

            ctx.store.addBlock('affine:paragraph', { text }, parent, index);

            ctx.store.deleteBlock(model);

            // Clears
            ctx.reset();
            ctx.select('note');

            ctx.track('SelectedView', {
              ...trackBaseProps,
              control: 'select view',
              type: 'inline view',
            });
          },
        },
        {
          id: 'card',
          label: 'Card view',
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
            if (!model) return;

            const { url, caption } = model.props;
            if (!url) return;

            const { parent } = model;
            const index = parent?.children.indexOf(model);

            const flavour = 'affine:bookmark';
            const style =
              BookmarkStyles.find(s => s !== 'vertical' && s !== 'cube') ??
              BookmarkStyles[1];

            const blockId = ctx.store.addBlock(
              flavour,
              { url, caption, style },
              parent,
              index
            );

            ctx.store.deleteBlock(model);

            // Selects new block
            ctx.select('note', [
              ctx.selection.create(BlockSelection, { blockId }),
            ]);

            ctx.track('SelectedView', {
              ...trackBaseProps,
              control: 'select view',
              type: 'card view',
            });
          },
        },
        {
          id: 'embed',
          label: 'Embed view',
          disabled: true,
        },
      ],
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({ ...action }));
        const toggle = (e: CustomEvent<boolean>) => {
          const opened = e.detail;
          if (!opened) return;

          ctx.track('OpenedViewSelector', {
            ...trackBaseProps,
            control: 'switch view',
          });
        };

        return html`${keyed(
          model,
          html`<affine-view-dropdown-menu
            .actions=${actions}
            .context=${ctx}
            .toggle=${toggle}
            .viewTypeSignal=${signal(actions[2].label)}
          ></affine-view-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    captionAction('d.caption'),
    {
      id: 'e.convert-to-linked-doc',
      tooltip: '创建链接文档',
      icon: LinkedPageIcon(),
      run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return;

        const { store, std, selection, track } = ctx;
        selection.clear();

        const draftedModels = [model].map(toDraftModel);
        const autofill = getTitleFromSelectedModels(draftedModels);
        promptDocTitle(std, autofill)
          .then(async title => {
            if (title === null) return;
            await convertSelectedBlocksToLinkedDoc(
              std,
              store,
              draftedModels,
              title
            );
            notifyDocCreated(std);

            track('DocCreated', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              control: 'create linked doc',
              type: 'embed-linked-doc',
            });

            track('LinkedDocCreated', {
              segment: 'doc',
              page: 'doc editor',
              module: 'toolbar',
              control: 'create linked doc',
              type: 'embed-linked-doc',
            });
          })
          .catch(console.error);
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'a.clipboard',
      actions: [
        {
          id: 'copy',
          label: '复制',
          icon: CopyIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
            if (!model) return;

            const slice = Slice.fromModels(ctx.store, [model]);
            ctx.clipboard
              .copySlice(slice)
              .then(() => toast(ctx.host, '已复制到剪贴板'))
              .catch(console.error);

            ctx.track('CopiedLink', {
              ...trackBaseProps,
              control: 'copy link',
            });
          },
        },
        {
          id: 'duplicate',
          label: '创建副本',
          icon: DuplicateIcon(),
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
            if (!model) return;

            const { flavour, parent } = model;
            const props = getBlockProps(model);
            const index = parent?.children.indexOf(model);

            ctx.store.addBlock(flavour, props, parent, index);
          },
        },
      ],
    },
    {
      placement: ActionPlacement.More,
      id: 'b.reload',
      label: '重新加载',
      icon: ResetIcon(),
      run(ctx) {
        const component = ctx.getCurrentBlockByType(EmbedIframeBlockComponent);
        component
          ?.refreshData()
          .then(success => {
            ctx.track('ReloadLink', {
              type: 'embed iframe block',
              page: 'doc editor',
              segment: 'doc',
              module: 'toolbar',
              control: 'reload link',
              result: success ? 'success' : 'failure',
            });
          })
          .catch(console.error);
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'b1.export-notebook',
      label: '导出 .ipynb',
      icon: OpenInNewIcon(),
      when: showWhenJupyterLite,
      async run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return;
        const notebookJson = await getCurrentNotebookJson(model);
        downloadNotebook(model, notebookJson);
        ctx.store.updateBlock(model, {
          lastSyncedAt: Date.now(),
          notebookJson,
          syncStatus: 'exported',
        });
        toast(ctx.host, '已导出 Notebook 快照');
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'b2.sync-notebook-to-blocks',
      label: '从 Notebook 同步到文档',
      icon: DuplicateIcon(),
      when: showWhenJupyterLite,
      async run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return;
        const ok = await syncNotebookToBlocks(ctx, model);
        toast(ctx.host, ok ? '已同步 Notebook 快照到文档' : '同步失败');
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'b3.sync-blocks-to-notebook',
      label: '从文档更新 Notebook',
      icon: DuplicateIcon(),
      when: showWhenJupyterLite,
      run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return;
        ctx.store.updateBlock(model, {
          lastSyncedAt: Date.now(),
          notebookJson: notebookFromFollowingBlocks(model),
          sourceMode: 'blocks',
          syncStatus: 'synced',
        });
        toast(ctx.host, '已用后续文本/代码块更新 Notebook 快照');
      },
    },
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      label: '删除',
      icon: DeleteIcon(),
      variant: 'destructive',
      run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return;

        ctx.store.deleteBlock(model);

        // Clears
        ctx.select('note');
        ctx.reset();
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

export const builtinSurfaceToolbarConfig = {
  actions: [
    openLinkAction('a.open-link'),
    {
      id: 'c.conversions',
      when: showWhenUrlExists,
      actions: [
        {
          id: 'card',
          label: 'Card view',
          run(ctx) {
            const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
            if (!model) return;

            const { id: oldId, xywh, parent } = model;
            const { url, caption } = model.props;

            if (!url) return;

            const style =
              BookmarkStyles.find(s => s !== 'vertical' && s !== 'cube') ??
              BookmarkStyles[1];
            let flavour = 'affine:bookmark';

            const bounds = Bound.deserialize(xywh);
            bounds.w = EMBED_CARD_WIDTH[style];
            bounds.h = EMBED_CARD_HEIGHT[style];

            const newId = ctx.store.addBlock(
              flavour,
              { url, caption, style, xywh: bounds.serialize() },
              parent
            );

            ctx.command.exec(reassociateConnectorsCommand, { oldId, newId });

            ctx.store.deleteBlock(model);

            // Selects new block
            ctx.gfx.selection.set({ editing: false, elements: [newId] });

            ctx.track('SelectedView', {
              ...trackBaseProps,
              control: 'select view',
              type: 'card view',
            });
          },
        },
        {
          id: 'embed',
          label: 'Embed view',
          disabled: true,
        },
      ],
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return null;

        const actions = this.actions.map(action => ({ ...action }));
        const onToggle = (e: CustomEvent<boolean>) => {
          if (!e.detail) return;

          ctx.track('OpenedViewSelector', {
            ...trackBaseProps,
            control: 'switch view',
          });
        };

        return html`${keyed(
          model,
          html`<affine-view-dropdown-menu
            @toggle=${onToggle}
            .actions=${actions}
            .context=${ctx}
            .viewTypeSignal=${signal(actions[1].label)}
          ></affine-view-dropdown-menu>`
        )}`;
      },
    } satisfies ToolbarActionGroup<ToolbarAction>,
    captionAction('d.caption'),
    {
      id: 'e.scale',
      content(ctx) {
        const model = ctx.getCurrentModelByType(EmbedIframeBlockModel);
        if (!model) return null;

        const scale$ = computed(() => {
          const scale = model.props.scale$.value ?? 1;
          return Math.round(100 * scale);
        });
        const onSelect = (e: CustomEvent<number>) => {
          e.stopPropagation();

          const scale = e.detail / 100;

          const bounds = Bound.deserialize(model.xywh);
          const oldScale = model.props.scale ?? 1;
          const ratio = scale / oldScale;
          bounds.w *= ratio;
          bounds.h *= ratio;
          const xywh = bounds.serialize();

          ctx.store.updateBlock(model, () => {
            model.xywh = xywh;
            model.props.scale = scale;
          });

          ctx.track('SelectedCardScale', {
            ...trackBaseProps,
            control: 'select card scale',
          });
        };
        const onToggle = (e: CustomEvent<boolean>) => {
          e.stopPropagation();

          const opened = e.detail;
          if (!opened) return;

          ctx.track('OpenedCardScaleSelector', {
            ...trackBaseProps,
            control: 'switch card scale',
          });
        };
        const format = (value: number) => `${value}%`;

        return html`${keyed(
          model,
          html`<affine-size-dropdown-menu
            @select=${onSelect}
            @toggle=${onToggle}
            .format=${format}
            .sizeSignal=${scale$}
          ></affine-size-dropdown-menu>`
        )}`;
      },
    },
  ],
  when: ctx => ctx.getSurfaceModelsByType(EmbedIframeBlockModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const createBuiltinToolbarConfigExtension = (
  flavour: string
): ExtensionType[] => {
  const name = flavour.split(':').pop();

  return [
    ToolbarModuleExtension({
      id: BlockFlavourIdentifier(flavour),
      config: builtinToolbarConfig,
    }),
    ToolbarModuleExtension({
      id: BlockFlavourIdentifier(`affine:surface:${name}`),
      config: builtinSurfaceToolbarConfig,
    }),
  ];
};
