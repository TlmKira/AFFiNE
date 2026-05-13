import { Badge } from '@affine/admin/components/ui/badge';
import { Button } from '@affine/admin/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@affine/admin/components/ui/card';
import { cn } from '@affine/admin/utils';
import { get } from 'lodash-es';
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleDashedIcon,
} from 'lucide-react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { Link } from 'react-router-dom';

import { Header } from '../header';
import { useAppConfig } from '../settings/use-app-config';

type ProviderStatus = {
  id: string;
  name: string;
  description: string;
  configured: boolean;
};

const getSecretConfigured = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0;

const StatusBadge = ({
  configured,
  enabledLabel = '已配置',
  disabledLabel = '未配置',
}: {
  configured: boolean;
  enabledLabel?: string;
  disabledLabel?: string;
}) => (
  <Badge
    variant={configured ? 'default' : 'outline'}
    className={cn(
      'gap-1.5',
      configured
        ? 'bg-emerald-600 hover:bg-emerald-600'
        : 'text-muted-foreground'
    )}
  >
    {configured ? (
      <CheckCircle2Icon size={13} />
    ) : (
      <CircleDashedIcon size={13} />
    )}
    {configured ? enabledLabel : disabledLabel}
  </Badge>
);

function AiPage() {
  const { appConfig } = useAppConfig();
  const copilot = appConfig.copilot ?? {};
  const providers = copilot.providers ?? {};
  const aiEnabled = Boolean(copilot.enabled);
  const byokEnabled = Boolean(get(copilot, 'byok.enabled'));
  const customEndpointEnabled = Boolean(
    get(copilot, 'byok.allowCustomEndpoint')
  );

  const providerStatuses: ProviderStatus[] = [
    {
      id: 'openai',
      name: 'OpenAI / OpenAI-compatible',
      description:
        '用于聊天、写作、总结，也支持兼容 OpenAI 协议的私有模型接口。',
      configured: getSecretConfigured(get(providers, 'openai.apiKey')),
    },
    {
      id: 'gemini',
      name: 'Gemini',
      description: 'Google Gemini API，可用于文本和多模态能力。',
      configured: getSecretConfigured(get(providers, 'gemini.apiKey')),
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude API，可用于文本生成和推理。',
      configured: getSecretConfigured(get(providers, 'anthropic.apiKey')),
    },
    {
      id: 'fal',
      name: 'fal',
      description: '可选的图像生成 provider。',
      configured: getSecretConfigured(get(providers, 'fal.apiKey')),
    },
  ];

  const configuredCount = providerStatuses.filter(
    provider => provider.configured
  ).length;

  return (
    <div className="h-dvh flex-1 flex-col flex">
      <Header title="AI 配置" />
      <ScrollAreaPrimitive.Root
        className={cn('relative overflow-hidden w-full')}
      >
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
            <Card>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>自部署 AI</CardTitle>
                    <CardDescription className="mt-2 max-w-2xl">
                      AI 使用你自己的外部模型 API Key。不需要本地模型、GPU
                      或额外 AI 容器。
                    </CardDescription>
                  </div>
                  <StatusBadge
                    configured={aiEnabled}
                    enabledLabel="已启用"
                    disabledLabel="未启用"
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="text-sm font-semibold">全局 AI 开关</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {aiEnabled
                      ? '服务器 AI 功能已启用。'
                      : '需要先在系统配置中启用 copilot，用户才能使用 AI。'}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="text-sm font-semibold">服务器密钥</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {configuredCount > 0
                      ? `已配置 ${configuredCount} 个 provider。`
                      : '还没有配置服务器级 provider key。'}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="text-sm font-semibold">工作区 BYOK</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {byokEnabled
                      ? '工作区管理员可以添加自己的 provider key。'
                      : '工作区级 BYOK 已关闭。'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Provider 状态</CardTitle>
                <CardDescription>
                  密钥保存在服务器配置或工作区 BYOK 中。本页只显示是否已配置。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {providerStatuses.map(provider => (
                  <div
                    key={provider.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-4"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        {provider.name}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {provider.description}
                      </div>
                    </div>
                    <StatusBadge configured={provider.configured} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">如何配置</CardTitle>
                <CardDescription>
                  服务器级密钥在系统配置页填写；工作区 BYOK
                  密钥由工作区管理员在工作区设置中填写。
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="flex items-start gap-2">
                    <CircleAlertIcon
                      size={18}
                      className="mt-0.5 text-amber-600"
                    />
                    <div className="text-sm text-muted-foreground">
                      不要把真实 API Key
                      提交到仓库。请在管理后台或服务器私有配置文件中填写。
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild>
                    <Link to="/admin/settings#config-module-copilot">
                      打开密钥配置
                    </Link>
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    工作区密钥入口：工作区设置 / 集成 / AI BYOK。
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  工作区 BYOK 的自定义 OpenAI-compatible endpoint 当前
                  {customEndpointEnabled ? '允许使用' : '未开放'}。
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollAreaPrimitive.Viewport>
        <ScrollAreaPrimitive.ScrollAreaScrollbar
          className={cn(
            'flex touch-none select-none transition-colors',
            'h-full w-2.5 border-l border-l-transparent p-[1px]'
          )}
        >
          <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
        </ScrollAreaPrimitive.ScrollAreaScrollbar>
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    </div>
  );
}

export { AiPage as Component };
