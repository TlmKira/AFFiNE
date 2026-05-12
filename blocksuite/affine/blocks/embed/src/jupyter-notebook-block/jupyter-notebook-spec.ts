import { JupyterNotebookBlockSchema } from '@blocksuite/affine-model';
import { SlashMenuConfigExtension } from '@blocksuite/affine-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blocksuite/std';
import type { ExtensionType } from '@blocksuite/store';
import { literal } from 'lit/static-html.js';

import { jupyterNotebookSlashMenuConfig } from './slash-menu.js';

const flavour = JupyterNotebookBlockSchema.model.flavour;

export const JupyterNotebookViewExtensions: ExtensionType[] = [
  FlavourExtension(flavour),
  BlockViewExtension(flavour, literal`affine-jupyter-notebook-block`),
  SlashMenuConfigExtension(flavour, jupyterNotebookSlashMenuConfig),
];
