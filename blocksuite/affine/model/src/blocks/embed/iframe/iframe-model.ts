import {
  type GfxCommonBlockProps,
  GfxCompatible,
  type GfxElementGeometry,
} from '@blocksuite/std/gfx';
import { BlockModel } from '@blocksuite/store';

import { type EmbedCardStyle } from '../../../utils/index.js';

export const EmbedIframeStyles = ['figma'] as const satisfies EmbedCardStyle[];

export type EmbedIframeBlockProps = {
  url: string; // the original url that user input
  iframeUrl?: string; // the url that will be used to iframe src
  width?: number;
  height?: number;
  caption: string | null;
  title: string | null;
  description: string | null;
  notebookJson?: string;
  lastSyncedAt?: number;
  sourceMode?: 'ipynb' | 'blocks';
  syncStatus?: 'idle' | 'synced' | 'exported' | 'error';
  recentOutputsSummary?: string | null;
} & Omit<GfxCommonBlockProps, 'rotate'>;

export const defaultEmbedIframeProps: EmbedIframeBlockProps = {
  url: '',
  iframeUrl: '',
  width: undefined,
  height: undefined,
  caption: null,
  title: null,
  description: null,
  notebookJson: undefined,
  lastSyncedAt: undefined,
  sourceMode: undefined,
  syncStatus: undefined,
  recentOutputsSummary: null,
  xywh: '[0,0,0,0]',
  index: 'a0',
  lockedBySelf: false,
  scale: 1,
};

export class EmbedIframeBlockModel
  extends GfxCompatible<EmbedIframeBlockProps>(BlockModel)
  implements GfxElementGeometry {}
