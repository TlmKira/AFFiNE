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
  enabledLabel = 'Configured',
  disabledLabel = 'Not configured',
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
        'Chat, writing, summaries, and compatible private model APIs.',
      configured: getSecretConfigured(get(providers, 'openai.apiKey')),
    },
    {
      id: 'gemini',
      name: 'Gemini',
      description:
        'Google Gemini API provider for text and multimodal features.',
      configured: getSecretConfigured(get(providers, 'gemini.apiKey')),
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Claude API provider for text generation and reasoning.',
      configured: getSecretConfigured(get(providers, 'anthropic.apiKey')),
    },
    {
      id: 'fal',
      name: 'fal',
      description: 'Optional image generation provider.',
      configured: getSecretConfigured(get(providers, 'fal.apiKey')),
    },
  ];

  const configuredCount = providerStatuses.filter(
    provider => provider.configured
  ).length;

  return (
    <div className="h-dvh flex-1 flex-col flex">
      <Header title="AI" />
      <ScrollAreaPrimitive.Root
        className={cn('relative overflow-hidden w-full')}
      >
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] [&>div]:!block">
          <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
            <Card>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Self-hosted AI</CardTitle>
                    <CardDescription className="mt-2 max-w-2xl">
                      AI uses your own external model API keys. No local model,
                      GPU, or separate AI container is required.
                    </CardDescription>
                  </div>
                  <StatusBadge
                    configured={aiEnabled}
                    enabledLabel="Enabled"
                    disabledLabel="Disabled"
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="text-sm font-semibold">Global AI switch</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {aiEnabled
                      ? 'Server AI features are enabled.'
                      : 'Enable copilot in Settings before users can use AI.'}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="text-sm font-semibold">Server keys</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {configuredCount > 0
                      ? `${configuredCount} provider${configuredCount > 1 ? 's' : ''} configured.`
                      : 'No server provider key is configured yet.'}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="text-sm font-semibold">Workspace BYOK</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {byokEnabled
                      ? 'Workspace owners can add their own provider keys.'
                      : 'Workspace-level BYOK is disabled.'}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Provider status</CardTitle>
                <CardDescription>
                  Keys are stored in server configuration or workspace BYOK.
                  This page only shows whether a provider is configured.
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
                <CardTitle className="text-lg">How to configure</CardTitle>
                <CardDescription>
                  Use the admin Settings page for server-wide keys, or workspace
                  settings for BYOK keys controlled by workspace admins.
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
                      Do not commit real API keys. Configure them in the admin
                      panel or in the server&apos;s private config file.
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button asChild>
                    <Link to="/admin/settings#config-module-copilot">
                      Open AI settings
                    </Link>
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Workspace keys are configured from Workspace Settings /
                    Integrations / AI BYOK.
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Custom OpenAI-compatible endpoints are{' '}
                  {customEndpointEnabled ? 'allowed' : 'disabled'} for workspace
                  BYOK.
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
