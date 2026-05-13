import { upperFirst } from 'lodash-es';
import type { ComponentType } from 'react';

import CONFIG_DESCRIPTORS from '../../config.json';
import type { ConfigInputProps } from './config-input-row';
import { SendTestEmail } from './operations/send-test-email';
export type ConfigType = 'String' | 'Number' | 'Boolean' | 'JSON' | 'Enum';

type ConfigDescriptor = {
  desc: string;
  type: ConfigType;
  env?: string;
  link?: string;
};

export type AppConfig = Record<string, Record<string, any>>;

type AppConfigDescriptors = typeof CONFIG_DESCRIPTORS;
type AppConfigModule = keyof AppConfigDescriptors;
type ModuleConfigDescriptors<M extends AppConfigModule> =
  AppConfigDescriptors[M];
type ConfigGroup<T extends AppConfigModule> = {
  name: string;
  module: T;
  fields: Array<
    | keyof ModuleConfigDescriptors<T>
    | ({
        key: keyof ModuleConfigDescriptors<T>;
        sub?: string;
        desc?: string;
      } & Partial<ConfigInputProps>)
  >;
  operations?: ComponentType<{
    appConfig: AppConfig;
  }>[];
};
const IGNORED_MODULES: (keyof AppConfig)[] = [];

if (environment.isSelfHosted) {
  IGNORED_MODULES.push(
    'payment',
    'customerIo',
    'captcha',
    'telemetry',
    'metrics'
  );
}

const ALL_CONFIGURABLE_MODULES = Object.keys(CONFIG_DESCRIPTORS).filter(
  key => !IGNORED_MODULES.includes(key as keyof AppConfig)
);

export const KNOWN_CONFIG_GROUPS = [
  {
    name: 'Server',
    module: 'server',
    fields: ['externalUrl', 'name', 'hosts'],
  } as ConfigGroup<'server'>,
  {
    name: 'Auth',
    module: 'auth',
    fields: [
      'allowSignup',
      'allowSignupForOauth',
      // nested json object
      {
        key: 'passwordRequirements',
        sub: 'min',
        type: 'Number',
        desc: 'Minimum length requirement of password',
      },
      {
        key: 'passwordRequirements',
        sub: 'max',
        type: 'Number',
        desc: 'Maximum length requirement of password',
      },
    ],
  } as ConfigGroup<'auth'>,
  {
    name: 'Notification',
    module: 'mailer',
    fields: [
      'SMTP.name',
      'SMTP.host',
      'SMTP.port',
      'SMTP.username',
      'SMTP.password',
      'SMTP.ignoreTLS',
      'SMTP.sender',
    ],
    operations: [SendTestEmail],
  } as ConfigGroup<'mailer'>,
  {
    name: 'Storage',
    module: 'storages',
    fields: [
      {
        key: 'blob.storage',
        desc: 'The storage provider for user uploaded blobs',
        sub: 'provider',
        type: 'Enum',
        options: ['fs', 'aws-s3', 'cloudflare-r2'],
      },
      {
        key: 'blob.storage',
        sub: 'bucket',
        type: 'String',
        desc: 'The bucket name for user uploaded blobs storage',
      },
      {
        key: 'blob.storage',
        sub: 'config',
        type: 'JSON',
        desc: 'The S3 compatible config for the storage provider (endpoint/region/credentials).',
      },
      {
        key: 'avatar.storage',
        desc: 'The storage provider for user avatars',
        sub: 'provider',
        type: 'Enum',
        options: ['fs', 'aws-s3', 'cloudflare-r2'],
      },
      {
        key: 'avatar.storage',
        sub: 'bucket',
        type: 'String',
        desc: 'The bucket name for user avatars storage',
      },
      {
        key: 'avatar.storage',
        sub: 'config',
        type: 'JSON',
        desc: 'The S3 compatible config for the storage provider (endpoint/region/credentials).',
      },
      {
        key: 'avatar.publicPath',
        type: 'String',
        desc: 'The public path prefix for user avatars(e.g. https://my-bucket.s3.amazonaws.com/)',
      },
    ],
  } as ConfigGroup<'storages'>,
  {
    name: 'OAuth',
    module: 'oauth',
    fields: ['providers.google', 'providers.github', 'providers.oidc'],
  } as ConfigGroup<'oauth'>,
  {
    name: 'AI 配置',
    module: 'copilot',
    fields: [
      {
        key: 'enabled',
        desc: '全局 AI 开关。开启后，用户才能使用 AI 助手、总结、写作等能力。',
      },
      {
        key: 'byok.enabled',
        desc: '是否允许工作区管理员配置自己的 AI Key（BYOK）。',
      },
      {
        key: 'byok.allowedProviders',
        type: 'JSON',
        desc: '工作区 BYOK 允许使用的 provider 列表，例如 ["openai","anthropic","gemini","fal"]。',
      },
      {
        key: 'byok.allowCustomEndpoint',
        desc: '是否允许工作区 BYOK 使用自定义 OpenAI-compatible endpoint。',
      },
      {
        key: 'providers.openai',
        desc: 'OpenAI 或 OpenAI-compatible 配置。填写 apiKey；如使用中转或私有模型，把 baseURL 改成对应 /v1 地址。',
      },
      {
        key: 'providers.gemini',
        desc: 'Google Gemini API 配置。填写 apiKey 后可使用 Gemini provider。',
      },
      {
        key: 'providers.anthropic',
        desc: 'Anthropic Claude API 配置。填写 apiKey 后可使用 Claude provider。',
      },
      {
        key: 'providers.fal',
        desc: 'fal 图像生成 provider 配置。仅需要图像生成时填写。',
      },
      {
        key: 'providers.defaults',
        desc: '默认模型路由配置。留空时系统会按可用 provider 自动选择；高级用户可在这里指定各类输出默认 provider。',
      },
      {
        key: 'providers.profiles',
        desc: '高级 provider profile 列表。一般自部署可先保持空数组。',
      },
      {
        key: 'unsplash',
        desc: 'Unsplash 图片搜索 Key。未配置时相关图片搜索能力不可用。',
      },
      {
        key: 'exa',
        desc: 'Exa 网页搜索 Key。未配置时 AI 联网搜索能力不可用。',
      },
      {
        key: 'storage',
        desc: 'AI 附件和临时文件存储 provider',
        sub: 'provider',
        type: 'Enum',
        options: ['fs', 'aws-s3', 'cloudflare-r2'],
      },
      {
        key: 'storage',
        sub: 'bucket',
        type: 'String',
        desc: 'AI 附件存储 bucket 名称',
      },
      {
        key: 'storage',
        sub: 'config',
        type: 'JSON',
        desc: 'AI 附件存储配置。本地 fs 可保持默认；S3/R2 需填写 endpoint、region、credentials 等。',
      },
    ],
  } as ConfigGroup<'copilot'>,
];

export const UNKNOWN_CONFIG_GROUPS = ALL_CONFIGURABLE_MODULES.filter(
  module => !KNOWN_CONFIG_GROUPS.some(group => group.module === module)
).map(module => ({
  name: upperFirst(module),
  module,
  // @ts-expect-error allow
  fields: Object.keys(CONFIG_DESCRIPTORS[module]),
  operations: undefined,
}));

export const ALL_SETTING_GROUPS = [
  ...KNOWN_CONFIG_GROUPS,
  ...UNKNOWN_CONFIG_GROUPS,
];

export const ALL_CONFIG_DESCRIPTORS = CONFIG_DESCRIPTORS as Record<
  string,
  Record<string, ConfigDescriptor>
>;
