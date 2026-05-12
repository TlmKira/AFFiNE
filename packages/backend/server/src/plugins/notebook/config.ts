import { z } from 'zod';

import { defineModuleConfig } from '../../base';

declare global {
  interface AppConfigSchema {
    notebook: {
      enabled: boolean;
      gatewayUrl: string;
      gatewayToken: string;
      idleTimeoutSeconds: number;
      maxOutputBytes: number;
      maxConcurrentKernels: number;
    };
  }
}

defineModuleConfig('notebook', {
  enabled: {
    desc: 'Enable self-hosted Jupyter notebook runtime proxy',
    default: false,
    env: ['AFFINE_NOTEBOOK_ENABLED', 'boolean'],
  },
  gatewayUrl: {
    desc: 'Jupyter Kernel Gateway or Jupyter Server URL',
    default: 'http://localhost:8888',
    env: ['AFFINE_NOTEBOOK_GATEWAY_URL', 'string'],
    validate: value => z.string().url().safeParse(value),
  },
  gatewayToken: {
    desc: 'Jupyter Gateway token. Leave empty only for trusted local runtimes.',
    default: '',
    env: ['AFFINE_NOTEBOOK_GATEWAY_TOKEN', 'string'],
  },
  idleTimeoutSeconds: {
    desc: 'Notebook kernel idle timeout in seconds',
    default: 900,
    env: ['AFFINE_NOTEBOOK_IDLE_TIMEOUT_SECONDS', 'integer'],
    shape: z.number().int().positive(),
  },
  maxOutputBytes: {
    desc: 'Maximum output bytes returned from a single cell execution',
    default: 2_000_000,
    env: ['AFFINE_NOTEBOOK_MAX_OUTPUT_BYTES', 'integer'],
    shape: z.number().int().positive(),
  },
  maxConcurrentKernels: {
    desc: 'Maximum concurrent notebook kernels per AFFiNE process',
    default: 8,
    env: ['AFFINE_NOTEBOOK_MAX_CONCURRENT_KERNELS', 'integer'],
    shape: z.number().int().positive(),
  },
});
