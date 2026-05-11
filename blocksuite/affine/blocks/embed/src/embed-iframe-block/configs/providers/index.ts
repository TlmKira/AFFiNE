import { BilibiliEmbedConfig } from './bilibili';
import { ExcalidrawEmbedConfig } from './excalidraw';
import { GenericEmbedConfig } from './generic';
import { GoogleDocsEmbedConfig } from './google-docs';
import { GoogleDriveEmbedConfig } from './google-drive';
import { JupyterLiteEmbedConfig } from './jupyterlite';
import { MiroEmbedConfig } from './miro';
import { SpotifyEmbedConfig } from './spotify';

export * from './jupyterlite';

export const EmbedIframeConfigExtensions = [
  SpotifyEmbedConfig,
  GoogleDriveEmbedConfig,
  MiroEmbedConfig,
  ExcalidrawEmbedConfig,
  GoogleDocsEmbedConfig,
  BilibiliEmbedConfig,
  JupyterLiteEmbedConfig,
  GenericEmbedConfig,
];
